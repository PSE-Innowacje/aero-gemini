from typing import Any

from sqlalchemy import asc, desc, select
from sqlalchemy.orm import Session


class BaseRepository:
    def __init__(self, db: Session, model: type):
        self.db = db
        self.model = model

    def list(self, skip: int = 0, limit: int = 50, sort_by: str = "id", sort_dir: str = "asc") -> list[Any]:
        stmt = select(self.model)
        order_col = getattr(self.model, sort_by, self.model.id)
        stmt = stmt.order_by(asc(order_col) if sort_dir == "asc" else desc(order_col))
        return list(self.db.scalars(stmt.offset(skip).limit(limit)))

    def get(self, obj_id: int) -> Any | None:
        return self.db.get(self.model, obj_id)

    def create(self, data: dict) -> Any:
        obj = self.model(**data)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj: Any, data: dict) -> Any:
        for key, value in data.items():
            setattr(obj, key, value)
        self.db.commit()
        self.db.refresh(obj)
        return obj
