import hashlib
import hmac
import os
import random
import string
from datetime import datetime, timedelta
from sqlalchemy import inspect, or_, text
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from models import AppRelease, db, LicenseKey, ReleaseDownloadToken, User

load_dotenv()

OWNER_EMAIL = os.getenv('OWNER_EMAIL', 'Milanraemaekers62@gmail.com').strip().lower()
OWNER_UI_ACCESS = 'core,owner-console,multi-ui,diagnostics,advanced-controls'
DEFAULT_UI_ACCESS = 'core'
OWNER_ROLES = ('owner', 'admin')
AVAILABLE_ROLE_VALUES = ('user', 'admin', 'owner')
AVAILABLE_ACCOUNT_STATUS_VALUES = ('active', 'restricted', 'blacklisted')
KEY_ALPHABET = string.ascii_uppercase + string.digits
UPDATE_PRODUCTS = ('tracex-launcher',)
UPDATE_CHANNELS = ('stable', 'beta')
DEFAULT_UPDATE_PRODUCT = 'tracex-launcher'
DEFAULT_UPDATE_CHANNEL = 'stable'
DOWNLOAD_TOKEN_TTL_MINUTES = int(os.getenv('DOWNLOAD_TOKEN_TTL_MINUTES', '10'))
DEFAULT_RELEASES_DIR = os.path.join(os.path.dirname(__file__), 'releases')


def get_database_url():
    database_url = os.getenv('DATABASE_URL', '').strip()
    if not database_url:
        return 'sqlite:///protoncloud.db'
    if database_url.startswith('postgres://'):
        return database_url.replace('postgres://', 'postgresql://', 1)
    return database_url


def get_submitted_secret(payload):
    password_hash = (payload or {}).get('passwordHash')
    if password_hash:
        return password_hash

    password = (payload or {}).get('password')
    if password:
        return hashlib.sha256(password.encode('utf-8')).hexdigest()

    return None


def normalize_email(email):
    return (email or '').strip().lower()


def parse_ui_access(raw_value):
    return [item for item in (raw_value or '').split(',') if item]


def serialize_ui_access(items):
    seen = []
    for item in items:
        item = (item or '').strip()
        if item and item not in seen:
            seen.append(item)
    if DEFAULT_UI_ACCESS not in seen:
        seen.insert(0, DEFAULT_UI_ACCESS)
    return ','.join(seen)


def parse_access_input(raw_value):
    if isinstance(raw_value, list):
        values = raw_value
    else:
        values = str(raw_value or '').replace(';', ',').split(',')
    return [value.strip() for value in values if value and value.strip()]


def is_owner_email(email):
    return normalize_email(email) == OWNER_EMAIL


def normalize_role(role, email=None):
    role = (role or 'user').strip().lower()
    if is_owner_email(email):
        return 'owner'
    if role not in AVAILABLE_ROLE_VALUES or role == 'owner':
        return 'user' if role not in ('admin',) else 'admin'
    return role


def normalize_status(status):
    status = (status or 'active').strip().lower()
    if status not in AVAILABLE_ACCOUNT_STATUS_VALUES:
        return 'active'
    return status


def normalize_product(value):
    product = (value or DEFAULT_UPDATE_PRODUCT).strip().lower()
    if product not in UPDATE_PRODUCTS:
      return DEFAULT_UPDATE_PRODUCT
    return product


def normalize_channel(value):
    channel = (value or DEFAULT_UPDATE_CHANNEL).strip().lower()
    if channel not in UPDATE_CHANNELS:
        return DEFAULT_UPDATE_CHANNEL
    return channel


def normalize_bool(value):
    if isinstance(value, bool):
        return value
    return str(value or '').strip().lower() in ('1', 'true', 'yes', 'on')


def parse_int(value, fallback=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def apply_account_tier(user):
    changed = False
    if is_owner_email(user.email):
        expected_role = 'owner'
        expected_ui_access = OWNER_UI_ACCESS
    else:
        expected_role = normalize_role(user.role, user.email)
        expected_ui_access = serialize_ui_access(parse_access_input(user.ui_access or DEFAULT_UI_ACCESS))
    if user.role != expected_role:
        user.role = expected_role
        changed = True
    if user.ui_access != expected_ui_access:
        user.ui_access = expected_ui_access
        changed = True
    expected_status = normalize_status(getattr(user, 'status', 'active'))
    if getattr(user, 'status', None) != expected_status:
        user.status = expected_status
        changed = True
    return changed


def active_key_queryset(email):
    now = datetime.utcnow()
    return LicenseKey.query.filter(
        LicenseKey.assigned_email == normalize_email(email),
        LicenseKey.active.is_(True),
        or_(LicenseKey.expires_at.is_(None), LicenseKey.expires_at > now),
    )


def generate_key_value(prefix='PROTON'):
    chunks = []
    for _ in range(4):
        chunks.append(''.join(random.choice(KEY_ALPHABET) for _ in range(4)))
    return prefix + '-' + '-'.join(chunks)


def is_key_expired(key):
    return bool(key.expires_at and key.expires_at <= datetime.utcnow())


def is_download_token_expired(token):
    return bool(token.expires_at and token.expires_at <= datetime.utcnow())


def get_access_signature(raw_value):
    return tuple(sorted(parse_ui_access(serialize_ui_access(parse_access_input(raw_value)))))


def compare_versions(left, right):
    def normalize(version):
        parts = str(version or '').strip().lstrip('vV').split('.')
        normalized = []
        for part in parts:
            digits = ''.join(character for character in part if character.isdigit())
            normalized.append(int(digits or '0'))
        return normalized

    left_parts = normalize(left)
    right_parts = normalize(right)
    max_length = max(len(left_parts), len(right_parts), 1)
    left_parts.extend([0] * (max_length - len(left_parts)))
    right_parts.extend([0] * (max_length - len(right_parts)))

    if left_parts < right_parts:
        return -1
    if left_parts > right_parts:
        return 1
    return 0


def get_release_storage_dir():
    configured_dir = os.getenv('RELEASES_DIR', '').strip()
    return configured_dir or DEFAULT_RELEASES_DIR


def build_release_file_path(file_name):
    safe_name = os.path.basename(file_name or '').strip()
    if not safe_name:
        return None
    return os.path.join(get_release_storage_dir(), safe_name)


def hash_download_token(raw_token):
    secret = app.config['SECRET_KEY'].encode('utf-8')
    return hmac.new(secret, raw_token.encode('utf-8'), hashlib.sha256).hexdigest()


def create_download_token_value():
    return ''.join(random.choice(KEY_ALPHABET) for _ in range(48))


def resolve_key_for_redemption(key_value):
    normalized_key_value = (key_value or '').strip().upper()
    if not normalized_key_value:
        return None, (jsonify({'success': False, 'message': 'License key is required.'}), 400)
    key = LicenseKey.query.filter_by(key_value=normalized_key_value).first()
    if not key:
        return None, (jsonify({'success': False, 'message': 'Invalid license key.'}), 404)
    if not key.active:
        return None, (jsonify({'success': False, 'message': 'License key is revoked.'}), 409)
    if is_key_expired(key):
        return None, (jsonify({'success': False, 'message': 'License key has expired.'}), 409)
    return key, None


def user_already_has_access(user, granted_access):
    required_access = set(parse_ui_access(serialize_ui_access(parse_access_input(granted_access))))
    effective_access = set(get_effective_ui_access(user))
    return required_access.issubset(effective_access)


def serialize_key(key):
    return {
        'keyValue': key.key_value,
        'label': key.label or '',
        'grantedAccess': parse_ui_access(key.granted_access),
        'assignedEmail': key.assigned_email,
        'active': bool(key.active),
        'createdBy': key.created_by,
        'createdAt': key.created_at.isoformat() if key.created_at else None,
        'expiresAt': key.expires_at.isoformat() if key.expires_at else None,
        'expired': is_key_expired(key),
    }


def serialize_release(release, include_file_path=False):
    payload = {
        'id': release.id,
        'product': release.product,
        'channel': release.channel,
        'version': release.version,
        'notes': release.notes or '',
        'fileName': release.file_name,
        'fileSize': release.file_size,
        'sha256': release.sha256,
        'requiredAccess': parse_ui_access(release.required_access),
        'active': bool(release.active),
        'forceUpdate': bool(release.force_update),
        'createdAt': release.created_at.isoformat() if release.created_at else None,
        'createdBy': release.created_by,
    }
    if include_file_path:
        payload['filePath'] = release.file_path
    return payload


def get_effective_ui_access(user):
    effective = parse_access_input(user.ui_access)
    for key in active_key_queryset(user.email).all():
        for access_item in parse_ui_access(key.granted_access):
            if access_item not in effective:
                effective.append(access_item)
    return effective


def has_release_access(user, release):
    required_access = parse_ui_access(release.required_access)
    if not required_access:
        return True
    effective_access = set(get_effective_ui_access(user))
    return set(required_access).issubset(effective_access)


def serialize_download_token(token, raw_token=None):
    payload = {
        'id': token.id,
        'releaseId': token.release_id,
        'email': token.email,
        'deviceId': token.device_id,
        'issuedAt': token.issued_at.isoformat() if token.issued_at else None,
        'expiresAt': token.expires_at.isoformat() if token.expires_at else None,
        'downloadedAt': token.downloaded_at.isoformat() if token.downloaded_at else None,
        'revoked': bool(token.revoked),
        'consumed': bool(token.consumed),
        'ipAddress': token.ip_address,
        'userAgent': token.user_agent,
    }
    if raw_token:
        payload['token'] = raw_token
    return payload


def get_authenticated_user_from_payload(data):
    email = normalize_email(data.get('email'))
    submitted_secret = get_submitted_secret(data)
    user = User.query.filter_by(email=email).first()
    if not user or not submitted_secret or not check_password_hash(user.password_hash, submitted_secret):
        return None, (jsonify({'success': False, 'message': 'Invalid credentials.'}), 401)
    if apply_account_tier(user):
        db.session.commit()
    user_status = normalize_status(getattr(user, 'status', 'active'))
    if user_status != 'active':
        return None, (jsonify({'success': False, 'message': f'Account is {user_status}.'}), 403)
    return user, None


def get_latest_release(product, channel):
    releases = AppRelease.query.filter_by(product=product, channel=channel, active=True).order_by(AppRelease.created_at.desc()).all()
    if not releases:
        return None
    best_release = releases[0]
    for release in releases[1:]:
        if compare_versions(best_release.version, release.version) < 0:
            best_release = release
    return best_release


def issue_release_download_token(release, user, device_id=None):
    raw_token = create_download_token_value()
    expires_at = datetime.utcnow() + timedelta(minutes=max(DOWNLOAD_TOKEN_TTL_MINUTES, 1))
    token = ReleaseDownloadToken(
        release_id=release.id,
        email=user.email,
        device_id=(device_id or '').strip() or None,
        token_hash=hash_download_token(raw_token),
        expires_at=expires_at,
        ip_address=(request.headers.get('X-Forwarded-For') or request.remote_addr or '')[:128] or None,
        user_agent=(request.headers.get('User-Agent') or '')[:255] or None,
    )
    db.session.add(token)
    db.session.commit()
    return token, raw_token


def ensure_schema():
    with app.app_context():
        db.create_all()
        inspector = inspect(db.engine)
        user_columns = {column['name'] for column in inspector.get_columns('users')}
        release_tables = set(inspector.get_table_names())
        with db.engine.begin() as connection:
            if 'role' not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user'"))
            if 'status' not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active'"))
            if 'created_at' not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME"))
            if 'last_login_at' not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))
            if 'ui_access' not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN ui_access TEXT NOT NULL DEFAULT 'core'"))
            if 'app_releases' not in release_tables:
                connection.execute(text(
                    "CREATE TABLE app_releases ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "product VARCHAR(64) NOT NULL DEFAULT 'tracex-launcher', "
                    "channel VARCHAR(32) NOT NULL DEFAULT 'stable', "
                    "version VARCHAR(64) NOT NULL, "
                    "notes TEXT, "
                    "file_name VARCHAR(255) NOT NULL, "
                    "file_path VARCHAR(512) NOT NULL, "
                    "file_size INTEGER, "
                    "sha256 VARCHAR(64), "
                    "required_access TEXT NOT NULL DEFAULT 'core', "
                    "active BOOLEAN NOT NULL DEFAULT 1, "
                    "force_update BOOLEAN NOT NULL DEFAULT 0, "
                    "created_at DATETIME NOT NULL, "
                    "created_by VARCHAR(120)"
                    ")"
                ))
            if 'release_download_tokens' not in release_tables:
                connection.execute(text(
                    "CREATE TABLE release_download_tokens ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "release_id INTEGER NOT NULL, "
                    "email VARCHAR(120) NOT NULL, "
                    "device_id VARCHAR(255), "
                    "token_hash VARCHAR(64) NOT NULL UNIQUE, "
                    "issued_at DATETIME NOT NULL, "
                    "expires_at DATETIME NOT NULL, "
                    "downloaded_at DATETIME, "
                    "revoked BOOLEAN NOT NULL DEFAULT 0, "
                    "consumed BOOLEAN NOT NULL DEFAULT 0, "
                    "ip_address VARCHAR(128), "
                    "user_agent VARCHAR(255), "
                    "FOREIGN KEY(release_id) REFERENCES app_releases(id)"
                    ")"
                ))
        grouped_users = {}
        for user in User.query.order_by(User.id.asc()).all():
            normalized_email = normalize_email(user.email)
            if normalized_email not in grouped_users:
                grouped_users[normalized_email] = []
            grouped_users[normalized_email].append(user)

        for normalized_email in grouped_users:
            users = grouped_users[normalized_email]
            primary_user = None
            index = 0
            while index < len(users):
                if users[index].email == normalized_email:
                    primary_user = users[index]
                    break
                index += 1
            if primary_user is None:
                primary_user = users[0]

            index = 0
            while index < len(users):
                if users[index].id != primary_user.id:
                    LicenseKey.query.filter_by(assigned_email=users[index].email).update({'assigned_email': normalized_email})
                    db.session.delete(users[index])
                index += 1

        db.session.flush()

        for user in User.query.order_by(User.id.asc()).all():
            normalized_email = normalize_email(user.email)
            if user.email != normalized_email:
                user.email = normalized_email
            if not user.created_at:
                user.created_at = datetime.utcnow()
            apply_account_tier(user)
        db.session.commit()


def serialize_user(user):
    return {
        'email': user.email,
        'role': user.role,
        'status': normalize_status(getattr(user, 'status', 'active')),
        'createdAt': user.created_at.isoformat() if user.created_at else None,
        'lastLoginAt': user.last_login_at.isoformat() if user.last_login_at else None,
        'uiAccess': get_effective_ui_access(user),
        'baseUiAccess': parse_ui_access(user.ui_access),
        'activeKeys': [serialize_key(key) for key in active_key_queryset(user.email).all()],
        'isOwner': user.role == 'owner',
    }


def get_actor_from_payload(data, owner_only=False):
    requester_email = normalize_email(data.get('requesterEmail'))
    requester_secret = get_submitted_secret({
        'password': data.get('requesterPassword'),
        'passwordHash': data.get('requesterPasswordHash'),
    })
    actor = User.query.filter_by(email=requester_email).first()
    if not actor or not requester_secret or not check_password_hash(actor.password_hash, requester_secret):
        return None, (jsonify({'success': False, 'message': 'Owner authentication failed.'}), 401)
    if apply_account_tier(actor):
        db.session.commit()
    actor_status = normalize_status(getattr(actor, 'status', 'active'))
    if actor_status != 'active':
        return None, (jsonify({'success': False, 'message': f'Account is {actor_status}.'}), 403)
    if owner_only and actor.role != 'owner':
        return None, (jsonify({'success': False, 'message': 'Owner role required.'}), 403)
    if actor.role not in OWNER_ROLES:
        return None, (jsonify({'success': False, 'message': 'Admin access required.'}), 403)
    return actor, None


def set_user_access(target_user, requested_access):
    if is_owner_email(target_user.email):
        target_user.ui_access = OWNER_UI_ACCESS
        target_user.role = 'owner'
        return
    parsed = parse_access_input(requested_access)
    target_user.ui_access = serialize_ui_access(parsed or [DEFAULT_UI_ACCESS])


os.makedirs(get_release_storage_dir(), exist_ok=True)


app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = get_database_url()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-change-me')
CORS(app)
db.init_app(app)
ensure_schema()

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = normalize_email(data.get('email'))
    submitted_secret = get_submitted_secret(data)
    license_key_value = data.get('licenseKey')
    if not email or not submitted_secret:
        return jsonify({'success': False, 'message': 'Email and password are required.'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'Email already registered.'}), 409
    redeemed_key = None
    if license_key_value:
        redeemed_key, error_response = resolve_key_for_redemption(license_key_value)
        if error_response:
            return error_response
        if redeemed_key.assigned_email:
            return jsonify({'success': False, 'message': 'License key already used.'}), 409
    password_hash = generate_password_hash(submitted_secret)
    role = 'owner' if is_owner_email(email) else 'user'
    ui_access = OWNER_UI_ACCESS if role == 'owner' else DEFAULT_UI_ACCESS
    user = User(email=email, password_hash=password_hash, role=role, status='active', created_at=datetime.utcnow(), ui_access=ui_access)
    db.session.add(user)
    if redeemed_key:
        redeemed_key.assigned_email = email
    db.session.commit()
    return jsonify({'success': True, 'message': 'User registered.', 'user': serialize_user(user)})

@app.route('/auth', methods=['POST'])
def auth():
    data = request.get_json() or {}
    email = normalize_email(data.get('email'))
    submitted_secret = get_submitted_secret(data)
    user = User.query.filter_by(email=email).first()
    if not user or not submitted_secret or not check_password_hash(user.password_hash, submitted_secret):
        return jsonify({'success': False, 'message': 'Invalid credentials.'}), 401
    if apply_account_tier(user):
        db.session.commit()
    user_status = normalize_status(getattr(user, 'status', 'active'))
    if user_status != 'active':
        return jsonify({'success': False, 'message': f'Account is {user_status}.'}), 403
    user.last_login_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'message': 'Authenticated.', 'user': serialize_user(user)})


@app.route('/keys/redeem', methods=['POST'])
def redeem_key():
    data = request.get_json() or {}
    email = normalize_email(data.get('email'))
    submitted_secret = get_submitted_secret(data)
    user = User.query.filter_by(email=email).first()
    if not user or not submitted_secret or not check_password_hash(user.password_hash, submitted_secret):
        return jsonify({'success': False, 'message': 'Invalid credentials.'}), 401
    if apply_account_tier(user):
        db.session.commit()
    user_status = normalize_status(getattr(user, 'status', 'active'))
    if user_status != 'active':
        return jsonify({'success': False, 'message': f'Account is {user_status}.'}), 403

    key, error_response = resolve_key_for_redemption(data.get('licenseKey'))
    if error_response:
        return error_response
    if key.assigned_email == user.email:
        return jsonify({'success': False, 'message': 'License key already redeemed on this account.'}), 409
    if key.assigned_email:
        return jsonify({'success': False, 'message': 'License key already used.'}), 409
    if user_already_has_access(user, key.granted_access):
        return jsonify({'success': False, 'message': 'You already own this product access.'}), 409

    key.assigned_email = user.email
    db.session.commit()
    return jsonify({'success': True, 'message': 'License key redeemed.', 'user': serialize_user(user), 'key': serialize_key(key)})


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'success': True, 'message': 'API is running.'})


@app.route('/updates/check', methods=['POST'])
def update_check():
    data = request.get_json() or {}
    user, error_response = get_authenticated_user_from_payload(data)
    if error_response:
        return error_response

    product = normalize_product(data.get('product'))
    channel = normalize_channel(data.get('channel'))
    current_version = (data.get('currentVersion') or '').strip()
    device_id = (data.get('deviceId') or '').strip() or None

    release = get_latest_release(product, channel)
    if not release:
        return jsonify({'success': True, 'message': 'No release available.', 'updateAvailable': False})
    if not has_release_access(user, release):
        return jsonify({'success': False, 'message': 'Your account is not entitled to this release.'}), 403

    update_available = compare_versions(current_version, release.version) < 0 if current_version else True
    token_payload = None
    if update_available:
        token, raw_token = issue_release_download_token(release, user, device_id)
        token_payload = serialize_download_token(token, raw_token=raw_token)

    return jsonify({
        'success': True,
        'message': 'Update check completed.',
        'updateAvailable': update_available,
        'currentVersion': current_version or None,
        'release': serialize_release(release),
        'downloadToken': token_payload,
    })


@app.route('/updates/download/<token_value>', methods=['GET'])
def update_download(token_value):
    token_hash = hash_download_token((token_value or '').strip())
    token = ReleaseDownloadToken.query.filter_by(token_hash=token_hash).first()
    if not token:
        return jsonify({'success': False, 'message': 'Download token not found.'}), 404
    if token.revoked:
        return jsonify({'success': False, 'message': 'Download token revoked.'}), 403
    if token.consumed:
        return jsonify({'success': False, 'message': 'Download token already used.'}), 409
    if is_download_token_expired(token):
        return jsonify({'success': False, 'message': 'Download token expired.'}), 410

    release = AppRelease.query.get(token.release_id)
    if not release or not release.active:
        return jsonify({'success': False, 'message': 'Release is no longer available.'}), 404
    if not os.path.isfile(release.file_path):
        return jsonify({'success': False, 'message': 'Release file is missing on the server.'}), 404

    token.downloaded_at = datetime.utcnow()
    token.consumed = True
    db.session.commit()
    return send_file(release.file_path, as_attachment=True, download_name=release.file_name)


@app.route('/admin/releases', methods=['POST'])
def admin_create_release():
    data = request.get_json() or {}
    actor, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response

    product = normalize_product(data.get('product'))
    channel = normalize_channel(data.get('channel'))
    version = (data.get('version') or '').strip()
    file_name = (data.get('fileName') or '').strip()
    notes = (data.get('notes') or '').strip()
    sha256 = (data.get('sha256') or '').strip().lower() or None
    required_access = serialize_ui_access(parse_access_input(data.get('requiredAccess') or DEFAULT_UI_ACCESS))
    force_update = normalize_bool(data.get('forceUpdate'))

    if not version or not file_name:
        return jsonify({'success': False, 'message': 'Version and file name are required.'}), 400
    file_path = build_release_file_path(file_name)
    if not file_path or not os.path.isfile(file_path):
        return jsonify({'success': False, 'message': 'Release file not found in releases directory.'}), 404

    existing = AppRelease.query.filter_by(product=product, channel=channel, version=version).first()
    if existing:
        return jsonify({'success': False, 'message': 'Release version already exists for this channel.'}), 409

    release = AppRelease(
        product=product,
        channel=channel,
        version=version,
        notes=notes,
        file_name=file_name,
        file_path=file_path,
        file_size=os.path.getsize(file_path),
        sha256=sha256,
        required_access=required_access,
        active=True,
        force_update=force_update,
        created_at=datetime.utcnow(),
        created_by=actor.email,
    )
    db.session.add(release)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Release registered.', 'release': serialize_release(release, include_file_path=True)})


@app.route('/admin/releases/list', methods=['POST'])
def admin_list_releases():
    data = request.get_json() or {}
    _, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response

    releases = [serialize_release(release, include_file_path=True) for release in AppRelease.query.order_by(AppRelease.created_at.desc()).all()]
    return jsonify({'success': True, 'message': 'Releases loaded.', 'releases': releases})


@app.route('/admin/releases/toggle', methods=['POST'])
def admin_toggle_release():
    data = request.get_json() or {}
    _, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response

    release_id = parse_int(data.get('releaseId'))
    release = AppRelease.query.get(release_id)
    if not release:
        return jsonify({'success': False, 'message': 'Release not found.'}), 404
    release.active = normalize_bool(data.get('active'))
    db.session.commit()
    return jsonify({'success': True, 'message': 'Release updated.', 'release': serialize_release(release, include_file_path=True)})


@app.route('/admin/releases/tokens', methods=['POST'])
def admin_list_release_tokens():
    data = request.get_json() or {}
    _, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response

    limit = max(1, min(parse_int(data.get('limit'), 50), 250))
    tokens = [serialize_download_token(token) for token in ReleaseDownloadToken.query.order_by(ReleaseDownloadToken.issued_at.desc()).limit(limit).all()]
    return jsonify({'success': True, 'message': 'Download tokens loaded.', 'tokens': tokens})


@app.route('/admin/releases/tokens/revoke', methods=['POST'])
def admin_revoke_release_token():
    data = request.get_json() or {}
    _, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response

    token_id = parse_int(data.get('tokenId'))
    token = ReleaseDownloadToken.query.get(token_id)
    if not token:
        return jsonify({'success': False, 'message': 'Download token not found.'}), 404
    token.revoked = True
    db.session.commit()
    return jsonify({'success': True, 'message': 'Download token revoked.', 'token': serialize_download_token(token)})


@app.route('/admin/overview', methods=['POST'])
def admin_overview():
    data = request.get_json() or {}
    actor, error_response = get_actor_from_payload(data, owner_only=False)
    if error_response:
        return error_response
    users = [serialize_user(user) for user in User.query.order_by(User.email.asc()).all()]
    keys = [serialize_key(key) for key in LicenseKey.query.order_by(LicenseKey.created_at.desc()).all()]
    return jsonify({
        'success': True,
        'message': 'Overview loaded.',
        'actor': serialize_user(actor),
        'users': users,
        'keys': keys,
    })


@app.route('/admin/users/role', methods=['POST'])
def admin_update_role():
    data = request.get_json() or {}
    actor, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response
    target_email = normalize_email(data.get('targetEmail'))
    role = normalize_role(data.get('role'), target_email)
    target_user = User.query.filter_by(email=target_email).first()
    if not target_user:
        return jsonify({'success': False, 'message': 'Target user not found.'}), 404
    if is_owner_email(target_email):
        target_user.role = 'owner'
        target_user.ui_access = OWNER_UI_ACCESS
    else:
        target_user.role = role
        set_user_access(target_user, data.get('uiAccess') or target_user.ui_access)
    apply_account_tier(target_user)
    db.session.commit()
    return jsonify({'success': True, 'message': 'User role updated.', 'user': serialize_user(target_user), 'actor': serialize_user(actor)})


@app.route('/admin/users/status', methods=['POST'])
def admin_update_status():
    data = request.get_json() or {}
    actor, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response
    target_email = normalize_email(data.get('targetEmail'))
    status = normalize_status(data.get('status'))
    target_user = User.query.filter_by(email=target_email).first()
    if not target_user:
        return jsonify({'success': False, 'message': 'Target user not found.'}), 404
    if is_owner_email(target_email):
        return jsonify({'success': False, 'message': 'Owner status cannot be modified.'}), 409
    target_user.status = status
    db.session.commit()
    return jsonify({'success': True, 'message': 'User status updated.', 'user': serialize_user(target_user), 'actor': serialize_user(actor)})


@app.route('/admin/users/delete', methods=['POST'])
def admin_delete_user():
    data = request.get_json() or {}
    actor, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response
    target_email = normalize_email(data.get('targetEmail'))
    target_user = User.query.filter_by(email=target_email).first()
    if not target_user:
        return jsonify({'success': False, 'message': 'Target user not found.'}), 404
    if is_owner_email(target_email):
        return jsonify({'success': False, 'message': 'Owner account cannot be deleted.'}), 409
    LicenseKey.query.filter_by(assigned_email=target_user.email).update({'assigned_email': None})
    db.session.delete(target_user)
    db.session.commit()
    return jsonify({'success': True, 'message': 'User deleted.', 'actor': serialize_user(actor)})


@app.route('/admin/keys/generate', methods=['POST'])
def admin_generate_keys():
    data = request.get_json() or {}
    _, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response
    count = int(data.get('count') or 1)
    count = max(1, min(count, 25))
    duration_hours = int(data.get('durationHours') or 0)
    label = (data.get('label') or '').strip()
    assign_email = normalize_email(data.get('assignEmail')) or None
    granted_access = serialize_ui_access(parse_access_input(data.get('grantedAccess') or 'multi-ui'))
    created_keys = []
    for _ in range(count):
        expires_at = datetime.utcnow() + timedelta(hours=duration_hours) if duration_hours > 0 else None
        key = LicenseKey(
            key_value=generate_key_value(),
            label=label,
            granted_access=granted_access,
            expires_at=expires_at,
            assigned_email=assign_email,
            created_by=normalize_email(data.get('requesterEmail')),
            active=True,
        )
        db.session.add(key)
        created_keys.append(key)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Access key(s) generated.', 'keys': [serialize_key(key) for key in created_keys]})


@app.route('/admin/keys/assign', methods=['POST'])
def admin_assign_key():
    data = request.get_json() or {}
    _, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response
    key_value = (data.get('keyValue') or '').strip().upper()
    assign_email = normalize_email(data.get('assignEmail'))
    key = LicenseKey.query.filter_by(key_value=key_value).first()
    if not key:
        return jsonify({'success': False, 'message': 'Key not found.'}), 404
    if not assign_email:
        return jsonify({'success': False, 'message': 'Assign email is required.'}), 400
    key.assigned_email = assign_email
    db.session.commit()
    return jsonify({'success': True, 'message': 'Key assigned.', 'key': serialize_key(key)})


@app.route('/admin/keys/unassign', methods=['POST'])
def admin_unassign_key():
    data = request.get_json() or {}
    _, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response
    key_value = (data.get('keyValue') or '').strip().upper()
    key = LicenseKey.query.filter_by(key_value=key_value).first()
    if not key:
        return jsonify({'success': False, 'message': 'Key not found.'}), 404
    key.assigned_email = None
    db.session.commit()
    return jsonify({'success': True, 'message': 'Key removed from user.', 'key': serialize_key(key)})


@app.route('/admin/keys/revoke', methods=['POST'])
def admin_revoke_key():
    data = request.get_json() or {}
    _, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response
    key_value = (data.get('keyValue') or '').strip().upper()
    key = LicenseKey.query.filter_by(key_value=key_value).first()
    if not key:
        return jsonify({'success': False, 'message': 'Key not found.'}), 404
    key.active = False
    db.session.commit()
    return jsonify({'success': True, 'message': 'Key revoked.', 'key': serialize_key(key)})


@app.route('/admin/keys/delete', methods=['POST'])
def admin_delete_key():
    data = request.get_json() or {}
    _, error_response = get_actor_from_payload(data, owner_only=True)
    if error_response:
        return error_response
    key_value = (data.get('keyValue') or '').strip().upper()
    key = LicenseKey.query.filter_by(key_value=key_value).first()
    if not key:
        return jsonify({'success': False, 'message': 'Key not found.'}), 404
    if key.assigned_email:
        return jsonify({'success': False, 'message': 'Assigned keys cannot be deleted.'}), 409
    db.session.delete(key)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Key deleted.'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')))
