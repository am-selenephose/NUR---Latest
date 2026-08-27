"""Tests for hardened agency_bridge.py with strict tool validation and zero silent fallbacks."""
import ast
from pathlib import Path
import uuid
import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.agentic.enums import WorkflowState
from app.brain.schemas import WorkflowProposal, WorkflowStepProposal
from app.db.rls import set_user_context
from app.mind.agency_bridge import AgencyBridgeError, submit_workflow_proposal
from app.models.agentic import AgentApproval, AgentPolicy, AgentRunEvent, AgentStep
from app.tests.conftest import register_user


def test_ast_agency_bridge_no_create_draft_plan_fallback():
    """Prove that 'create_draft_plan' is never used as a default/fallback expression in agency_bridge.py."""
    bridge_path = Path(__file__).resolve().parent.parent / "mind" / "agency_bridge.py"
    assert bridge_path.exists(), f"File not found: {bridge_path}"

    tree = ast.parse(bridge_path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        # Look for any BoolOp (e.g. x or "create_draft_plan") or default arg
        if isinstance(node, ast.BoolOp):
            for val in node.values:
                if isinstance(val, ast.Constant) and val.value == "create_draft_plan":
                    pytest.fail("Found 'create_draft_plan' fallback expression in agency_bridge.py AST!")
        elif isinstance(node, ast.Constant) and node.value == "create_draft_plan":
            pytest.fail("Found string literal 'create_draft_plan' in agency_bridge.py - no hardcoded fallbacks permitted!")


def test_workflow_step_requires_explicit_tool_version():
    """A proposed side effect must name the exact registered tool version."""
    with pytest.raises(ValidationError) as exc_info:
        WorkflowStepProposal(
            key="step_1",
            title="Draft plan",
            description="Create the owner-requested draft",
            tool_key="create_draft_plan",
            arguments={"title": "Plan", "steps": ["Verify it"]},
        )

    assert "tool_version" in str(exc_info.value)


@pytest.mark.asyncio
async def test_agency_bridge_rejects_missing_tool_key(client: AsyncClient, super_engine):
    res, email, password = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)

        # Proposal with empty tool_key must raise AgencyBridgeError, NOT silently map to create_draft_plan
        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Invalid step proposal",
            rationale="Testing missing tool key",
            steps=[
                WorkflowStepProposal(
                    key="step_1",
                    title="Do something mysterious",
                    description="No tool specified",
                    tool_key="",  # Empty tool key
                    tool_version="1",
                    requires_approval=True,
                )
            ],
        )

        with pytest.raises(AgencyBridgeError) as exc_info:
            await submit_workflow_proposal(db, owner_user_id=owner_user_id, proposal=proposal)

        assert "missing required 'tool_key'" in str(exc_info.value)
        assert "Zero silent fallback" in str(exc_info.value)


@pytest.mark.asyncio
async def test_agency_bridge_rejects_unknown_tool_via_compiler(client: AsyncClient, super_engine):
    res, email, password = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)

        # Step referencing unknown tool key must raise AgencyBridgeError
        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Unknown tool step",
            rationale="Testing unknown tool",
            steps=[
                WorkflowStepProposal(
                    key="step_1",
                    title="Unknown action",
                    description="Calls non-existent tool",
                    tool_key="non_existent_tool_12345",
                    tool_version="1",
                    arguments={"title": "test"},
                    requires_approval=True,
                )
            ],
        )

        with pytest.raises(AgencyBridgeError) as exc_info:
            await submit_workflow_proposal(db, owner_user_id=owner_user_id, proposal=proposal)

        assert "Unregistered Agency tool" in str(exc_info.value)


@pytest.mark.asyncio
async def test_agency_bridge_rejects_invalid_arguments_schema(client: AsyncClient, super_engine):
    res, email, password = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)

        # Passing unknown field 'objective' must fail validation
        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Invalid args workflow",
            rationale="Testing invalid args",
            steps=[
                WorkflowStepProposal(
                    key="step_1",
                    title="Draft plan with invalid objective",
                    description="Calls create_draft_plan with extra field",
                    tool_key="create_draft_plan",
                    tool_version="1",
                    arguments={"title": "Plan", "objective": "Invalid field"},
                    requires_approval=True,
                )
            ],
        )

        with pytest.raises(AgencyBridgeError) as exc_info:
            await submit_workflow_proposal(db, owner_user_id=owner_user_id, proposal=proposal)

        assert "Argument validation failed" in str(exc_info.value)
        assert "unknown field 'objective'" in str(exc_info.value)


@pytest.mark.asyncio
async def test_agency_bridge_rejects_cyclic_dependencies(client: AsyncClient, super_engine):
    res, email, password = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)

        db.add(AgentPolicy(
            owner_user_id=owner_user_id,
            initiative_level="SUGGEST",
            max_risk_class="R2_DURABLE_PRIVATE",
            permitted_tools=["create_draft_plan"],
            auto_run_tools=[],
        ))
        await db.flush()

        # Step 1 depends on Step 2, and Step 2 depends on Step 1
        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Cyclic workflow",
            rationale="Testing cycle detection",
            steps=[
                WorkflowStepProposal(
                    key="step_1",
                    title="Step 1",
                    description="Depends on step 2",
                    tool_key="create_draft_plan",
                    tool_version="1",
                    arguments={"title": "Step 1", "steps": ["Task 1"]},
                    dependencies=["step_2"],
                    requires_approval=True,
                ),
                WorkflowStepProposal(
                    key="step_2",
                    title="Step 2",
                    description="Depends on step 1",
                    tool_key="create_draft_plan",
                    tool_version="1",
                    arguments={"title": "Step 2", "steps": ["Task 2"]},
                    dependencies=["step_1"],
                    requires_approval=True,
                ),
            ],
        )

        workflow, compile_res = await submit_workflow_proposal(
            db, owner_user_id=owner_user_id, proposal=proposal
        )

        assert compile_res.ok is False
        assert workflow is None
        assert any("CYCLIC" in err.code for err in compile_res.errors)


@pytest.mark.asyncio
async def test_agency_bridge_strict_arguments_and_approval(client: AsyncClient, super_engine):
    res, email, password = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)

        db.add(AgentPolicy(
            owner_user_id=owner_user_id,
            initiative_level="SUGGEST",
            max_risk_class="R1_PRIVATE_DRAFT",
            permitted_tools=["create_draft_plan"],
            auto_run_tools=[],
        ))
        await db.flush()

        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Valid strict workflow",
            rationale="Strict argument forwarding",
            steps=[
                WorkflowStepProposal(
                    key="step_1",
                    title="Draft custom plan",
                    description="Create a draft plan with specific title",
                    tool_key="create_draft_plan",
                    tool_version="1",
                    arguments={"title": "Q3 Engineering Roadmap", "steps": ["Ship Capability Runtime"]},
                    requires_approval=True,
                    estimated_cost_cents=2,
                )
            ],
            total_estimated_cost_cents=2,
        )

        workflow, compile_res = await submit_workflow_proposal(
            db, owner_user_id=owner_user_id, proposal=proposal
        )

        assert compile_res.ok is True
        assert workflow is not None
        assert workflow.state == WorkflowState.PLAN_READY.value
        assert workflow.budget_cents == 2

        from sqlalchemy import select
        stmt = select(AgentStep).where(AgentStep.workflow_id == workflow.id)
        db_steps = (await db.execute(stmt)).scalars().all()
        assert len(db_steps) == 1
        assert db_steps[0].tool_key == "create_draft_plan"
        assert db_steps[0].input_refs["title"] == "Q3 Engineering Roadmap"
        assert db_steps[0].input_refs["steps"] == ["Ship Capability Runtime"]

        assert db_steps[0].approval_required is True
        assert db_steps[0].state == "WAITING_APPROVAL"
        stmt_app = select(AgentApproval).where(AgentApproval.workflow_id == workflow.id)
        db_approvals = (await db.execute(stmt_app)).scalars().all()
        assert len(db_approvals) == 1
        approval = db_approvals[0]
        assert approval.decision == "PENDING"
        assert approval.plan_version == workflow.plan_version
        assert approval.call_version.startswith("cv:")
        assert len(approval.call_version) == 67
        assert approval.call_version != "1"

        event_stmt = (
            select(AgentRunEvent)
            .where(AgentRunEvent.workflow_id == workflow.id)
            .order_by(AgentRunEvent.sequence)
        )
        events = (await db.execute(event_stmt)).scalars().all()
        assert [event.sequence for event in events] == [1, 2, 3]
        assert [event.event_type for event in events] == [
            "WORKFLOW_CREATED",
            "PLAN_COMPILED",
            "STEP_AWAITING_APPROVAL",
        ]


@pytest.mark.asyncio
async def test_agency_step_dependency_state_persists_blocked(client: AsyncClient, super_engine):
    """Prove that when step B depends on step A (which is auto-run/no approval), B persists BLOCKED."""
    res, email, password = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)

        # Policy allows create_draft_plan to auto-run (no approval)
        db.add(AgentPolicy(
            owner_user_id=owner_user_id,
            initiative_level="DELEGATED",
            max_risk_class="R1_PRIVATE_DRAFT",
            permitted_tools=["create_draft_plan"],
            auto_run_tools=["create_draft_plan"],
        ))
        await db.flush()

        # Step A is root (READY). Step B depends on A (BLOCKED on dependency).
        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Dependency chain workflow",
            rationale="Test dependency blocking",
            steps=[
                WorkflowStepProposal(
                    key="step_a",
                    title="Root step",
                    description="Creates initial plan",
                    tool_key="create_draft_plan",
                    tool_version="1",
                    arguments={"title": "Step A Plan", "steps": ["Task A"]},
                    requires_approval=False,
                ),
                WorkflowStepProposal(
                    key="step_b",
                    title="Dependent step",
                    description="Creates follow-up plan",
                    tool_key="create_draft_plan",
                    tool_version="1",
                    arguments={"title": "Step B Plan", "steps": ["Task B"]},
                    dependencies=["step_a"],
                    requires_approval=False,
                ),
            ],
        )

        workflow, compile_res = await submit_workflow_proposal(
            db, owner_user_id=owner_user_id, proposal=proposal
        )

        assert compile_res.ok is True
        assert workflow is not None

        from sqlalchemy import select
        stmt = select(AgentStep).where(AgentStep.workflow_id == workflow.id)
        db_steps = {s.key: s for s in (await db.execute(stmt)).scalars().all()}
        assert "step_a" in db_steps
        assert "step_b" in db_steps
        # Step A is root: READY
        assert db_steps["step_a"].state == "READY"
        # Step B depends on A: MUST persist BLOCKED by compiler authority
        assert db_steps["step_b"].state == "BLOCKED"


@pytest.mark.asyncio
async def test_agency_bridge_preserves_executor_and_security_reviewer_roles(
    client: AsyncClient,
    super_engine,
):
    """The real Brain-to-Agency bridge must preserve execution and review roles exactly."""
    res, _, _ = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)
        db.add(AgentPolicy(
            owner_user_id=owner_user_id,
            initiative_level="DELEGATED",
            max_risk_class="R1_PRIVATE_DRAFT",
            permitted_tools=["create_draft_plan", "get_today_state"],
            auto_run_tools=["get_today_state"],
        ))
        await db.flush()

        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Implement then independently review",
            rationale="The security reviewer must remain independent and read-only.",
            steps=[
                WorkflowStepProposal(
                    key="implement",
                    title="Draft the implementation plan",
                    role="implementer",
                    description="Create the bounded private draft.",
                    tool_key="create_draft_plan",
                    tool_version="1",
                    arguments={"title": "Implementation", "steps": ["Ship safely"]},
                ),
                WorkflowStepProposal(
                    key="security_review",
                    title="Review the implementation",
                    role="security_reviewer",
                    description="Read current owner state after implementation.",
                    tool_key="get_today_state",
                    tool_version="1",
                    arguments={},
                    dependencies=["implement"],
                ),
            ],
        )

        workflow, compile_res = await submit_workflow_proposal(
            db,
            owner_user_id=owner_user_id,
            proposal=proposal,
        )

        assert compile_res.ok is True
        assert workflow is not None
        assert [(step.key, step.role) for step in compile_res.steps] == [
            ("implement", "implementer"),
            ("security_review", "security_reviewer"),
        ]

        from sqlalchemy import select

        rows = (
            await db.execute(
                select(AgentStep)
                .where(AgentStep.workflow_id == workflow.id)
                .order_by(AgentStep.ordinal)
            )
        ).scalars().all()
        assert [(step.key, step.role) for step in rows] == [
            ("implement", "implementer"),
            ("security_review", "security_reviewer"),
        ]


@pytest.mark.asyncio
async def test_agency_bridge_rejects_mutating_security_reviewer(
    client: AsyncClient,
    super_engine,
):
    """A verifier role must hit the compiler's read-only rule through the real bridge."""
    res, _, _ = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)
        db.add(AgentPolicy(
            owner_user_id=owner_user_id,
            initiative_level="SUGGEST",
            max_risk_class="R1_PRIVATE_DRAFT",
            permitted_tools=["create_draft_plan"],
            auto_run_tools=[],
        ))
        await db.flush()

        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Invalid mutating review",
            rationale="The reviewer must not write the result it reviews.",
            steps=[
                WorkflowStepProposal(
                    key="implement",
                    title="Implement",
                    role="implementer",
                    description="Create the bounded draft.",
                    tool_key="create_draft_plan",
                    tool_version="1",
                    arguments={"title": "Implementation", "steps": ["Draft"]},
                ),
                WorkflowStepProposal(
                    key="security_review",
                    title="Mutating review",
                    role="security_reviewer",
                    description="This invalid reviewer attempts a mutation.",
                    tool_key="create_draft_plan",
                    tool_version="1",
                    arguments={"title": "Review", "steps": ["Mutate"]},
                    dependencies=["implement"],
                ),
            ],
        )

        workflow, compile_res = await submit_workflow_proposal(
            db,
            owner_user_id=owner_user_id,
            proposal=proposal,
        )

        assert workflow is None
        assert compile_res.ok is False
        assert any(
            error.code == "VERIFIER_MUTATES" and error.step_key == "security_review"
            for error in compile_res.errors
        )


@pytest.mark.asyncio
async def test_agency_bridge_rejects_same_role_self_verification(
    client: AsyncClient,
    super_engine,
):
    """A reviewer cannot verify work performed by the same reviewer role."""
    res, _, _ = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)
        db.add(AgentPolicy(
            owner_user_id=owner_user_id,
            initiative_level="DELEGATED",
            max_risk_class="R0_READ_ONLY",
            permitted_tools=["get_today_state"],
            auto_run_tools=["get_today_state"],
        ))
        await db.flush()

        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Invalid self verification",
            rationale="A security reviewer cannot review its own security-review step.",
            steps=[
                WorkflowStepProposal(
                    key="operator_read",
                    title="Read current state",
                    role="operator",
                    description="Read owner state.",
                    tool_key="get_today_state",
                    tool_version="1",
                    arguments={},
                ),
                WorkflowStepProposal(
                    key="first_review",
                    title="First security review",
                    role="security_reviewer",
                    description="Review operator output.",
                    tool_key="get_today_state",
                    tool_version="1",
                    arguments={},
                    dependencies=["operator_read"],
                ),
                WorkflowStepProposal(
                    key="second_review",
                    title="Second security review",
                    role="security_reviewer",
                    description="Invalidly review the same role's work.",
                    tool_key="get_today_state",
                    tool_version="1",
                    arguments={},
                    dependencies=["first_review"],
                ),
            ],
        )

        workflow, compile_res = await submit_workflow_proposal(
            db,
            owner_user_id=owner_user_id,
            proposal=proposal,
        )

        assert workflow is None
        assert compile_res.ok is False
        assert any(
            error.code == "SELF_VERIFICATION" and error.step_key == "second_review"
            for error in compile_res.errors
        )


@pytest.mark.asyncio
async def test_agency_bridge_rejects_verifier_without_subject(
    client: AsyncClient,
    super_engine,
):
    """A verifier must depend on work produced by an independent role."""
    res, _, _ = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)
        db.add(AgentPolicy(
            owner_user_id=owner_user_id,
            initiative_level="DELEGATED",
            max_risk_class="R0_READ_ONLY",
            permitted_tools=["get_today_state"],
            auto_run_tools=["get_today_state"],
        ))
        await db.flush()

        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Invalid subjectless verification",
            rationale="A review step cannot verify work that does not exist.",
            steps=[
                WorkflowStepProposal(
                    key="security_review",
                    title="Review without a subject",
                    role="security_reviewer",
                    description="Read owner state without an upstream execution step.",
                    tool_key="get_today_state",
                    tool_version="1",
                    arguments={},
                ),
            ],
        )

        workflow, compile_res = await submit_workflow_proposal(
            db,
            owner_user_id=owner_user_id,
            proposal=proposal,
        )

        assert workflow is None
        assert compile_res.ok is False
        assert any(
            error.code == "VERIFIER_WITHOUT_SUBJECT" and error.step_key == "security_review"
            for error in compile_res.errors
        )


@pytest.mark.asyncio
async def test_agency_bridge_rejects_dangling_dependency(
    client: AsyncClient,
    super_engine,
):
    """A proposal cannot reference an upstream step that is absent from its DAG."""
    res, _, _ = await register_user(client)
    owner_user_id = uuid.UUID(res.json()["id"])

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner_user_id)
        db.add(AgentPolicy(
            owner_user_id=owner_user_id,
            initiative_level="DELEGATED",
            max_risk_class="R0_READ_ONLY",
            permitted_tools=["get_today_state"],
            auto_run_tools=["get_today_state"],
        ))
        await db.flush()

        proposal = WorkflowProposal(
            task_id=uuid.uuid4(),
            title="Invalid dangling dependency",
            rationale="Every dependency must resolve inside the submitted proposal.",
            steps=[
                WorkflowStepProposal(
                    key="operator_read",
                    title="Read current state",
                    role="operator",
                    description="Read owner state after a missing predecessor.",
                    tool_key="get_today_state",
                    tool_version="1",
                    arguments={},
                    dependencies=["missing_step"],
                ),
            ],
        )

        workflow, compile_res = await submit_workflow_proposal(
            db,
            owner_user_id=owner_user_id,
            proposal=proposal,
        )

        assert workflow is None
        assert compile_res.ok is False
        assert any(
            error.code == "DANGLING_DEPENDENCY" and error.step_key == "operator_read"
            for error in compile_res.errors
        )


def test_safe_refusal_code_mapping():
    """Prove that internal compiler errors are mapped to bounded safe codes without leakage."""
    from app.mind.agency_bridge import SAFE_REFUSAL_CODES, map_compile_error_to_safe_code

    # Direct mappings
    assert map_compile_error_to_safe_code("POLICY_DENIED") == "POLICY_DENIED"
    assert map_compile_error_to_safe_code("UNKNOWN_TOOL") == "UNKNOWN_TOOL"
    assert map_compile_error_to_safe_code("RISK_EXCEEDS_POLICY") == "RISK_EXCEEDS_POLICY"
    assert map_compile_error_to_safe_code("DANGLING_DEPENDENCY") == "INVALID_DEPENDENCY"
    assert map_compile_error_to_safe_code("SELF_DEPENDENCY") == "INVALID_DEPENDENCY"
    assert map_compile_error_to_safe_code("CYCLIC_PLAN") == "INVALID_DEPENDENCY"
    assert map_compile_error_to_safe_code("VERIFIER_WITHOUT_SUBJECT") == "INVALID_DEPENDENCY"
    assert map_compile_error_to_safe_code("EMPTY_PLAN") == "INVALID_ARGUMENTS"
    assert map_compile_error_to_safe_code("DUPLICATE_STEP_KEY") == "INVALID_ARGUMENTS"
    assert map_compile_error_to_safe_code("VERIFIER_MUTATES") == "POLICY_DENIED"
    assert map_compile_error_to_safe_code("SELF_VERIFICATION") == "POLICY_DENIED"

    # Any unknown/arbitrary error falls back to safe COMPILATION_REFUSED
    assert map_compile_error_to_safe_code("INTERNAL_DB_CRASH") == "COMPILATION_REFUSED"
    assert map_compile_error_to_safe_code("UNEXPECTED_EXCEPTION") == "COMPILATION_REFUSED"

    # All outputs must belong to the closed SAFE_REFUSAL_CODES set
    for code in [
        "POLICY_DENIED", "UNKNOWN_TOOL", "RISK_EXCEEDS_POLICY", "DANGLING_DEPENDENCY",
        "SELF_DEPENDENCY", "CYCLIC_PLAN", "VERIFIER_WITHOUT_SUBJECT", "EMPTY_PLAN",
        "DUPLICATE_STEP_KEY", "VERIFIER_MUTATES", "SELF_VERIFICATION", "FOO_BAR",
    ]:
        res = map_compile_error_to_safe_code(code)
        assert res in SAFE_REFUSAL_CODES


def test_workflow_refused_serialization_privacy():
    """Prove that workflow.refused payload does not expose stack traces, SQL, or raw exception strings."""
    import json
    from app.mind.agency_bridge import map_compile_error_to_safe_code

    raw_errors = [
        {"code": "POLICY_DENIED", "message": "SELECT * FROM agent_policy WHERE id=1 -- secret leak", "step_key": "step_1"},
        {"code": "CYCLIC_PLAN", "message": "Traceback (most recent call last):\nFile 'foo.py' line 12", "step_key": "step_2"},
    ]

    safe_codes = [map_compile_error_to_safe_code(e["code"]) for e in raw_errors]

    event_payload = {
        "task_id": str(uuid.uuid4()),
        "reason_codes": safe_codes,
        "retryable": False,
    }

    serialized = json.dumps(event_payload)
    deserialized = json.loads(serialized)

    assert deserialized["reason_codes"] == ["POLICY_DENIED", "INVALID_DEPENDENCY"]
    assert deserialized["retryable"] is False
    assert "SELECT" not in serialized
    assert "Traceback" not in serialized
    assert "secret" not in serialized
    assert "message" not in serialized
    assert "errors" not in deserialized
