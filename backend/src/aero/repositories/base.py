from typing import Any

from loguru import logger
from sqlalchemy import asc, desc, select
from sqlalchemy.orm import Session


class BaseRepository:
    def __init__(self, db: Session, model: type):
        self.db = db
        self.model = model

    def list(self, skip: int = 0, limit: int = 50, sort_by: str = "id", sort_dir: str = "asc") -> list[Any]:
        op_logger = logger.bind(
            event="repository",
            operation="list",
            model=self.model.__name__,
            skip=skip,
            limit=limit,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        op_logger.debug("repository_operation_started")
        stmt = select(self.model)
        order_col = getattr(self.model, sort_by, self.model.id)
        stmt = stmt.order_by(asc(order_col) if sort_dir == "asc" else desc(order_col))
        items = list(self.db.scalars(stmt.offset(skip).limit(limit)))
        op_logger.bind(result_count=len(items)).debug("repository_operation_completed")
        return items

    def get(self, obj_id: int) -> Any | None:
        op_logger = logger.bind(
            event="repository",
            operation="get",
            model=self.model.__name__,
            obj_id=obj_id,
        )
        op_logger.debug("repository_operation_started")
        obj = self.db.get(self.model, obj_id)
        if obj is None:
            op_logger.warning("repository_object_not_found")
            return None
        op_logger.debug("repository_operation_completed")
        return obj

    def create(self, data: dict) -> Any:
        op_logger = logger.bind(
            event="repository",
            operation="create",
            model=self.model.__name__,
            fields=sorted(data.keys()),
        )
        op_logger.info("repository_operation_started")
        obj = self.model(**data)
        try:
            self.db.add(obj)
            self.db.commit()
            self.db.refresh(obj)
        except Exception:  # noqa: BLE001
            self.db.rollback()
            op_logger.exception("repository_operation_failed")
            raise
        op_logger.bind(obj_id=getattr(obj, "id", None)).info("repository_operation_completed")
        return obj

    def update(self, obj: Any, data: dict) -> Any:
        op_logger = logger.bind(
            event="repository",
            operation="update",
            model=self.model.__name__,
            obj_id=getattr(obj, "id", None),
            fields=sorted(data.keys()),
        )
        op_logger.info("repository_operation_started")
        for key, value in data.items():
            setattr(obj, key, value)
        try:
            self.db.commit()
            self.db.refresh(obj)
        except Exception:  # noqa: BLE001
            self.db.rollback()
            op_logger.exception("repository_operation_failed")
            raise
        op_logger.info("repository_operation_completed")
        return obj
