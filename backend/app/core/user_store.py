"""
Simple in-memory user store.
Replace with a real DB (PostgreSQL + SQLAlchemy) in production.
"""
from app.models.user import UserInDB, Role
from passlib.context import CryptContext

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserStore:
    def __init__(self):
        self._users: dict[str, UserInDB] = {}
        self._seed()

    def _seed(self):
        """Pre-populate demo accounts."""
        demos = [
            ("admin",    "admin123",    Role.ADMIN,    "Bank Admin"),
            ("lead",     "lead123",     Role.TEAMLEAD, "Team Lead"),
            ("analyst",  "analyst123",  Role.USER,     "Analyst"),
        ]
        for username, password, role, full_name in demos:
            self._users[username] = UserInDB(
                username=username,
                full_name=full_name,
                hashed_password=_pwd.hash(password),
                role=role,
                is_active=True,
            )

    def get(self, username: str) -> UserInDB | None:
        return self._users.get(username)

    def all(self) -> list[UserInDB]:
        return list(self._users.values())

    def create(self, user: UserInDB) -> None:
        self._users[user.username] = user

    def delete(self, username: str) -> bool:
        return bool(self._users.pop(username, None))


user_store = UserStore()
