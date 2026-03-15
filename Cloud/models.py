from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(32), nullable=False, default='user')
    status = db.Column(db.String(32), nullable=False, default='active')
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_login_at = db.Column(db.DateTime, nullable=True)
    ui_access = db.Column(db.Text, nullable=False, default='core')


class LicenseKey(db.Model):
    __tablename__ = 'license_keys'

    id = db.Column(db.Integer, primary_key=True)
    key_value = db.Column(db.String(64), unique=True, nullable=False, index=True)
    label = db.Column(db.String(120), nullable=True)
    granted_access = db.Column(db.Text, nullable=False, default='multi-ui')
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    assigned_email = db.Column(db.String(120), nullable=True)
    created_by = db.Column(db.String(120), nullable=True)


class AppRelease(db.Model):
    __tablename__ = 'app_releases'

    id = db.Column(db.Integer, primary_key=True)
    product = db.Column(db.String(64), nullable=False, default='tracex-launcher', index=True)
    channel = db.Column(db.String(32), nullable=False, default='stable', index=True)
    version = db.Column(db.String(64), nullable=False, index=True)
    notes = db.Column(db.Text, nullable=True)
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    file_size = db.Column(db.Integer, nullable=True)
    sha256 = db.Column(db.String(64), nullable=True)
    required_access = db.Column(db.Text, nullable=False, default='core')
    active = db.Column(db.Boolean, nullable=False, default=True)
    force_update = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_by = db.Column(db.String(120), nullable=True)

    download_tokens = db.relationship(
        'ReleaseDownloadToken',
        backref='release',
        lazy='dynamic',
        cascade='all, delete-orphan',
    )


class ReleaseDownloadToken(db.Model):
    __tablename__ = 'release_download_tokens'

    id = db.Column(db.Integer, primary_key=True)
    release_id = db.Column(db.Integer, db.ForeignKey('app_releases.id'), nullable=False, index=True)
    email = db.Column(db.String(120), nullable=False, index=True)
    device_id = db.Column(db.String(255), nullable=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    issued_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    downloaded_at = db.Column(db.DateTime, nullable=True)
    revoked = db.Column(db.Boolean, nullable=False, default=False)
    consumed = db.Column(db.Boolean, nullable=False, default=False)
    ip_address = db.Column(db.String(128), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
