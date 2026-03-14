from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import os

app = Flask(__name__)
CORS(app)
creds_path = Path(__file__).parent / 'credentials.json'
ADMIN_TOKEN = os.getenv('PROTON_ADMIN_TOKEN', 'supersecret-admin-token')

if not creds_path.exists():
    creds_path.write_text('{\n  "email": "admin@proton.io",\n  "passwordHash": "0e6ae23677aafbd39f3d029b8b1a9377b6056eed26ad567e561919038a9b7fee",\n  "licenseKey": "PROTON-KEY-1234"\n}\n', encoding='utf-8')

def get_creds():
    import json
    with creds_path.open('r', encoding='utf-8-sig') as f:
        data = json.load(f)
    if 'email' not in data or 'passwordHash' not in data or 'licenseKey' not in data:
        raise ValueError('Invalid credentials format')
    return data

def save_creds(creds):
    import json
    with creds_path.open('w', encoding='utf-8') as f:
        json.dump(creds, f, indent=2)

@app.route('/status', methods=['GET'])
def status():
    return jsonify({'success': True, 'status': 'online'})

@app.route('/auth', methods=['POST'])
def auth():
    try:
        body = request.get_json(force=True)
    except Exception:
        return jsonify({'success': False, 'message': 'Invalid JSON payload.'}), 400
    if not body or 'email' not in body or 'passwordHash' not in body or 'licenseKey' not in body:
        return jsonify({'success': False, 'message': 'Missing email, passwordHash, or licenseKey.'}), 400
    creds = get_creds()
    if body['email'] == creds['email'] and body['passwordHash'] == creds['passwordHash'] and body['licenseKey'] == creds['licenseKey']:
        return jsonify({'success': True, 'message': 'Authenticated'})
    return jsonify({'success': False, 'message': 'Invalid email, password, or license key.'}), 401

@app.route('/admin/update-key', methods=['POST'])
def update_key():
    try:
        body = request.get_json(force=True)
    except Exception:
        return jsonify({'success': False, 'message': 'Invalid JSON payload.'}), 400
    if not body or 'adminToken' not in body or 'licenseKey' not in body:
        return jsonify({'success': False, 'message': 'Missing adminToken or licenseKey.'}), 400
    if body['adminToken'] != ADMIN_TOKEN:
        return jsonify({'success': False, 'message': 'Invalid admin token.'}), 403
    creds = get_creds()
    creds['licenseKey'] = body['licenseKey']
    save_creds(creds)
    return jsonify({'success': True, 'message': 'License key updated.'})

@app.route('/', methods=['GET'])
def home():
    return '<h2>Proton Cloud Auth API is live.</h2>', 200

@app.route('/favicon.ico', methods=['GET'])
def favicon():
    return '', 204

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
