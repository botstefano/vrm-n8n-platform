-- Datos de ejemplo SOLO para pruebas locales. No ejecutar en producción.
INSERT INTO roles (code, name) VALUES ('admin','Administrador'), ('risk_analyst','Analista de riesgo'), ('auditor','Auditor')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (email, full_name) VALUES
  ('admin@vrm.local','Admin VRM'), ('analista@vrm.local','Analista VRM'), ('auditor@vrm.local','Auditor VRM')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON
  (u.email='admin@vrm.local' AND r.code='admin') OR
  (u.email='analista@vrm.local' AND r.code='risk_analyst') OR
  (u.email='auditor@vrm.local' AND r.code='auditor')
ON CONFLICT DO NOTHING;

INSERT INTO questionnaires (name, version, is_active) VALUES ('Cuestionario de seguridad estándar', 1, true);

INSERT INTO vendors (legal_name, website, status, criticality, current_risk, current_score, next_evaluation, primary_contact) VALUES
  ('GitHub, Inc.',        'https://github.com',      'approved',    4, 'low',    82.5, now() - INTERVAL '1 day', '{"email":"security@github.example"}'),
  ('Cloudflare, Inc.',    'https://www.cloudflare.com','monitoring', 5, 'medium', 64.0, now() + INTERVAL '30 days', '{"email":"security@cloudflare.example"}'),
  ('Example Corp',        'https://example.com',     'conditional', 2, 'high',   38.0, NULL, '{}');

INSERT INTO vendor_technologies (vendor_id, product_name, cpe_match)
SELECT id, 'nginx', 'cpe:2.3:a:nginx:nginx:*:*:*:*:*:*:*:*' FROM vendors WHERE legal_name = 'Cloudflare, Inc.';
INSERT INTO vendor_technologies (vendor_id, product_name, cpe_match)
SELECT id, 'OpenSSL', 'cpe:2.3:a:openssl:openssl:*:*:*:*:*:*:*:*' FROM vendors WHERE legal_name = 'GitHub, Inc.';
