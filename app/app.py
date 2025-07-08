from flask import Flask, redirect, render_template, request, session

import os
import psycopg2

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("home.html", page_title="Etusivu")


@app.route("/status")
def status():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute("SELECT version();")
    db_version = cur.fetchone()

    cur.close()
    conn.close()

    return f"Connected to DB: {db_version[0]}"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
