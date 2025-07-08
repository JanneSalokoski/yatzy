from flask import (
    Flask,
    redirect,
    render_template,
    request,
    g,
    url_for,
    jsonify,
    make_response,
)

import os
import psycopg2
import psycopg2.extras
import hashlib
import bcrypt
import functools
import logging

from auth import create_token, decode_token

app = Flask(__name__)

logger = logging.getLogger(__name__)


def create_slug(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:8]


def get_db():
    if "db" not in g:
        g.db = psycopg2.connect(
            os.environ["DATABASE_URL"], cursor_factory=psycopg2.extras.RealDictCursor
        )

    return g.db


def require_auth(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        token = request.cookies.get("token")
        logger.info(f"token: {token}")
        if not token:
            return jsonify({"error": "Missing token"}), 401

        player_id = decode_token(token)
        logger.info(f"player_id: {player_id}")

        if not player_id:
            return jsonify({"error": "Invalid or expired token"}), 401

        g.player_id = player_id
        return func(*args, **kwargs)

    return wrapper


def db_cursor(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        conn = get_db()
        cur = conn.cursor()
        res = func(*args, **kwargs, cur=cur, conn=conn)
        cur.close()
        return res

    return wrapper


@app.teardown_appcontext
def close_db(error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@app.route("/")
def index():
    return render_template("home.html", page_title="Etusivu")


@app.route("/login", methods=["GET", "POST"])
@db_cursor
def login(cur=None, conn=None):
    if request.method == "POST":
        name = request.form["name"]
        password = request.form["password"]

        query = "SELECT id, hash FROM players WHERE name = %s"
        cur.execute(query, (name,))
        player = cur.fetchone()

        if player and bcrypt.checkpw(password.encode(), player["hash"].encode()):
            token = create_token(player["id"])
            response = make_response(redirect(url_for("index")))
            response.set_cookie("token", token, httponly=True, samesite="Lax")
            return response

        else:
            return {"error": "Invalid credentials"}, 401

    else:
        return render_template("login.html")


@app.route("/logout")
def logout():
    response = make_response(redirect(url_for("index")))
    response.set_cookie("token", "", expires=0)
    return response


@app.route("/player", methods=["GET"])
@db_cursor
def create_user(cur=None, conn=None):
    return render_template("player_form.html", player=None)


@app.route("/player", methods=["POST"])
@require_auth
@db_cursor
def create_player(cur=None, conn=None):
    name = request.form["name"]
    slug = create_slug(name)
    password = request.form["password"]

    if not password:
        return {"error": "Password required"}, 400

    hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    query = "INSERT INTO players (slug, name, hash) VALUES (%s, %s, %s)"
    cur.execute(query, (slug, name, hash))

    conn.commit()
    return redirect(url_for("create_or_edit_player", player_slug=slug))


@app.route("/player/<string:player_slug>", methods=["GET", "POST"])
@require_auth
@db_cursor
def create_or_edit_player(cur=None, conn=None, player_slug=None):
    cur.execute("SELECT id, slug, name FROM players WHERE slug = %s", (player_slug,))
    player = cur.fetchone()

    print("player", player)
    print("player_id", g.player_id)

    if not player or int(g.player_id) != player["id"]:
        return {"error": "Unauthorized"}, 403

    if request.method == "POST":
        name = request.form["name"]
        password = request.form["password"]
        slug = create_slug(name)

        if password:
            hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            query = "UPDATE players SET name = %s, hash = %s WHERE slug = %s"
            cur.execute(query, (name, hash, slug))
        else:
            query = "UPDATE players SET name = %s WHERE slug = %s"
            cur.execute(query, (name, slug))

        conn.commit()
        return redirect(url_for("create_or_edit_player", player_slug=slug))

    return render_template("player_form.html", player=player)


@app.route("/status")
@db_cursor
def status(cur=None, conn=None):
    cur.execute("SELECT version();")
    db_version = cur.fetchone()

    return f"Connected to DB: {db_version[0]}"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
