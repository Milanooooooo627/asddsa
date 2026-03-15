from app import app, ensure_schema


def init_db():
    with app.app_context():
        ensure_schema()
        print('Database initialized.')


if __name__ == '__main__':
    init_db()
