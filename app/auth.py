import os
import jwt
import datetime
import logging

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-descret")
JWT_ALGORITHM = "HS256"

logger = logging.getLogger(__name__)


def create_token(player_id: str):
    payload = {
        "sub": str(player_id),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
    }

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])

    except jwt.ExpiredSignatureError as e:
        logger.error("Signature expired")
        logger.error(e)
        return None

    except jwt.InvalidTokenError as e:
        logger.error("Invalid token")
        logger.error(e)
        return None
