"""SQLAlchemy models for schema qc_engine. No FKs outside this schema."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class QcEngineBase(DeclarativeBase):
    metadata = MetaData(schema="qc_engine")


class InspectableItem(QcEngineBase):
    __tablename__ = "inspectable_item"
    __table_args__ = (UniqueConstraint("project_id", "code"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str | None] = mapped_column(Text)
    discipline_key: Mapped[str] = mapped_column(Text, nullable=False)
    topic_key: Mapped[str] = mapped_column(Text, nullable=False)
    element_type_key: Mapped[str] = mapped_column(Text, nullable=False)
    floor: Mapped[str | None] = mapped_column(Text)
    grid_ref: Mapped[str | None] = mapped_column(Text)
    grid_x: Mapped[str | None] = mapped_column(Text)
    grid_y: Mapped[str | None] = mapped_column(Text)
    location_note: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    request_items: Mapped[list[InspectionRequestItem]] = relationship(back_populates="inspectable_item")
    inspection_results: Mapped[list[InspectionResult]] = relationship(back_populates="inspectable_item")
    ncrs: Mapped[list[Ncr]] = relationship(back_populates="inspectable_item")


class InspectionRequest(QcEngineBase):
    __tablename__ = "inspection_request"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','submitted','scheduled','in_progress','completed','cancelled')",
            name="inspection_request_status_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    requested_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    activity_type: Mapped[str] = mapped_column(Text, nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'draft'"))
    assigned_inspector_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    items: Mapped[list[InspectionRequestItem]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )
    results: Mapped[list[InspectionResult]] = relationship(back_populates="request")


class InspectionRequestItem(QcEngineBase):
    __tablename__ = "inspection_request_item"
    __table_args__ = (UniqueConstraint("request_id", "inspectable_item_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("qc_engine.inspection_request.id", ondelete="CASCADE"),
        nullable=False,
    )
    inspectable_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("qc_engine.inspectable_item.id"),
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    request: Mapped[InspectionRequest] = relationship(back_populates="items")
    inspectable_item: Mapped[InspectableItem] = relationship(back_populates="request_items")


class ChecklistTemplate(QcEngineBase):
    __tablename__ = "checklist_template"
    __table_args__ = (
        UniqueConstraint("discipline_key", "topic_key", "element_type_key", "version"),
        CheckConstraint("source IN ('manual')", name="checklist_template_source_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    discipline_key: Mapped[str] = mapped_column(Text, nullable=False)
    topic_key: Mapped[str] = mapped_column(Text, nullable=False)
    element_type_key: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'manual'"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    items: Mapped[list[ChecklistTemplateItem]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )


class ChecklistTemplateItem(QcEngineBase):
    __tablename__ = "checklist_template_item"
    __table_args__ = (UniqueConstraint("template_id", "sort_order"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("qc_engine.checklist_template.id", ondelete="CASCADE"),
        nullable=False,
    )
    code: Mapped[str | None] = mapped_column(Text)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    allow_na: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    template: Mapped[ChecklistTemplate] = relationship(back_populates="items")
    results: Mapped[list[InspectionResult]] = relationship(back_populates="template_item")


class InspectionResult(QcEngineBase):
    __tablename__ = "inspection_result"
    __table_args__ = (
        UniqueConstraint("request_id", "inspectable_item_id", "template_item_id"),
        CheckConstraint("verdict IN ('pass','fail','na')", name="inspection_result_verdict_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("qc_engine.inspection_request.id", ondelete="CASCADE"),
        nullable=False,
    )
    inspectable_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("qc_engine.inspectable_item.id"),
        nullable=False,
    )
    template_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("qc_engine.checklist_template_item.id"),
        nullable=False,
    )
    verdict: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    inspector_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    inspected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    request: Mapped[InspectionRequest] = relationship(back_populates="results")
    inspectable_item: Mapped[InspectableItem] = relationship(back_populates="inspection_results")
    template_item: Mapped[ChecklistTemplateItem] = relationship(back_populates="results")
    photos: Mapped[list[InspectionResultPhoto]] = relationship(
        back_populates="result", cascade="all, delete-orphan"
    )
    ncrs: Mapped[list[Ncr]] = relationship(back_populates="inspection_result")


class InspectionResultPhoto(QcEngineBase):
    __tablename__ = "inspection_result_photo"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    result_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("qc_engine.inspection_result.id", ondelete="CASCADE"),
        nullable=False,
    )
    storage_ref: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    result: Mapped[InspectionResult] = relationship(back_populates="photos")


class Ncr(QcEngineBase):
    __tablename__ = "ncr"
    __table_args__ = (
        UniqueConstraint("project_id", "ncr_number"),
        CheckConstraint("severity IN ('minor','major','critical')", name="ncr_severity_check"),
        CheckConstraint(
            "root_cause_category IN ('material','workmanship','design','procedure','environment','other')",
            name="ncr_root_cause_category_check",
        ),
        CheckConstraint(
            "status IN ('open','in_progress','pending_verify','closed','waived')",
            name="ncr_status_check",
        ),
        Index(
            "ncr_one_open_per_result",
            "inspection_result_id",
            unique=True,
            postgresql_where=text("status NOT IN ('closed','waived')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    ncr_number: Mapped[str] = mapped_column(Text, nullable=False)
    inspection_result_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("qc_engine.inspection_result.id"),
        nullable=False,
    )
    inspectable_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("qc_engine.inspectable_item.id"),
        nullable=False,
    )
    severity: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause_category: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause_note: Mapped[str | None] = mapped_column(Text)
    corrective_action: Mapped[str | None] = mapped_column(Text)
    corrective_action_owner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'open'"))
    opened_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    closed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    inspection_result: Mapped[InspectionResult] = relationship(back_populates="ncrs")
    inspectable_item: Mapped[InspectableItem] = relationship(back_populates="ncrs")


class RolePermission(QcEngineBase):
    __tablename__ = "role_permission"
    __table_args__ = (
        UniqueConstraint("role_key", "resource"),
        CheckConstraint(
            "role_key IN ('supervisor','inspector','contractor_pm','client_pm','consultant')",
            name="role_permission_role_key_check",
        ),
        CheckConstraint(
            "resource IN ('inspectable_item','inspection_request','checklist_template','inspection_result','ncr')",
            name="role_permission_resource_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    role_key: Mapped[str] = mapped_column(Text, nullable=False)
    resource: Mapped[str] = mapped_column(Text, nullable=False)
    can_read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    can_create: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    can_update: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    can_delete: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    can_transition: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
