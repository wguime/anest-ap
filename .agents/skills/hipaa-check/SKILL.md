---
name: hipaa-check
description: Check code for HIPAA compliance violations and PII/PHI exposure. Use when reviewing healthcare applications, checking for data privacy issues, or when user asks about HIPAA compliance.
allowed-tools: Read, Grep, Glob, Bash
---

# HIPAA and PII Exposure Checker

Scan the codebase for HIPAA compliance violations, PII/PHI exposure, and insecure data handling practices.

## What to Check For

### 1. Protected Health Information (PHI) Patterns

Look for code that handles these data types without proper protection:
- **Patient identifiers**: SSN, medical record numbers, account numbers, patient IDs
- **Biometric data**: fingerprints, retinal scans, voice signatures
- **Medical data**: diagnoses, treatments, prescriptions, lab results, medical images
- **Demographic data**: names, addresses, dates of birth, phone numbers, emails
- **Insurance information**: policy numbers, group numbers, Medicare/Medicaid IDs
- **Device identifiers**: IP addresses, MAC addresses, serial numbers (when linked to PHI)

### 2. Insecure Storage

Flag these issues:
- PHI stored in **plain text** (databases, files, logs)
- Hardcoded PHI in source code or configuration files
- PHI in version control (git history, comments)
- Unencrypted data at rest (missing encryption for databases, file storage)
- PHI in temporary files, cache, or local storage without encryption
- Backups not encrypted

### 3. Insecure Transmission

Flag these patterns:
- PHI transmitted over **HTTP** instead of HTTPS
- Missing TLS/SSL for API calls handling PHI
- PHI in URL parameters or GET requests
- PHI in unencrypted email
- PHI sent to third-party services without BAA (Business Associate Agreement)
- Insufficient TLS version (< TLS 1.2)

### 4. Logging and Monitoring Issues

Flag these violations:
- PHI logged to console, application logs, or error messages
- PHI in debug statements or stack traces
- PHI in analytics or monitoring tools (e.g., Sentry, DataDog) without de-identification
- PHI in error messages displayed to users
- Audit logs missing for PHI access/modifications

### 5. Access Control Violations

Check for:
- Missing authentication/authorization for PHI endpoints
- Weak password requirements (< 8 chars, no complexity)
- Missing role-based access control (RBAC)
- PHI accessible without proper user verification
- Missing session timeouts or automatic logoff
- Shared credentials or default passwords

### 6. Code-Level Security Issues

Flag these patterns:
- SQL injection vulnerabilities with PHI queries
- Missing input validation on PHI fields
- Cross-site scripting (XSS) exposing PHI
- Insecure deserialization with PHI
- Missing CSRF protection on PHI forms
- PHI in client-side JavaScript or local storage

### 7. Third-Party and API Issues

Check for:
- PHI sent to third-party APIs without encryption
- Missing BAA validation for external services
- PHI in analytics (Google Analytics, Mixpanel, etc.)
- Excessive data sharing with external services
- Missing data minimization (sending more PHI than necessary)

## Analysis Process

1. **Scan the entire codebase** or specified files/directories
2. **Identify all locations** where PII/PHI is processed, stored, or transmitted
3. **Categorize findings** by severity:
   - 🔴 **Critical**: Direct PHI exposure, unencrypted transmission/storage
   - 🟡 **High**: Logging PHI, weak access controls, missing encryption
   - 🟢 **Medium**: Missing audit logs, insufficient validation, configuration issues
   - 🔵 **Low**: Documentation gaps, potential improvements

4. **Provide specific line numbers** and code snippets for each finding
5. **Explain the HIPAA violation** and potential consequences
6. **Recommend remediation** with code examples when possible

## Output Format

Provide results in this structure:

```
## HIPAA Compliance Scan Results

### Summary
- Total Issues Found: X
- Critical: X | High: X | Medium: X | Low: X
- Files Scanned: X

### Critical Issues 🔴

#### 1. [Issue Title]
- **File**: `path/to/file.py:123`
- **Severity**: Critical
- **HIPAA Rule**: Security Rule § 164.312(a)(2)(iv) / Privacy Rule § 164.514(b)
- **Description**: [What's wrong]
- **Code**:
  ```language
  [problematic code snippet]
  ```
- **Risk**: [Consequences if exploited]
- **Remediation**:
  - [Step-by-step fix]
  - Example:
    ```language
    [secure code example]
    ```

[Repeat for each issue]

### Recommendations

1. **Immediate Actions** (Critical/High issues)
   - [Action items]

2. **Short-term Improvements** (Medium issues)
   - [Action items]

3. **Best Practices**
   - Enable encryption at rest for all PHI databases
   - Implement audit logging for all PHI access
   - Regular security training for developers
   - Penetration testing and vulnerability scanning
   - Document BAAs with all third-party services
```

## Common Secure Patterns to Verify

Look for these **good practices** and note if they're missing:

- ✅ PHI encrypted at rest (AES-256 or equivalent)
- ✅ TLS 1.2+ for all PHI transmission
- ✅ PHI fields marked as `@Sensitive` or similar annotations
- ✅ Audit logs for create/read/update/delete operations on PHI
- ✅ Data masking in non-production environments
- ✅ Automatic session timeout (< 15 minutes idle)
- ✅ Multi-factor authentication for PHI access
- ✅ Regular access reviews and least privilege principle
- ✅ De-identification or anonymization for analytics
- ✅ Secure key management (AWS KMS, Azure Key Vault, etc.)

## Search Strategy

Use these tools efficiently:
1. **Grep** for suspicious patterns: `password`, `ssn`, `patient_id`, `medical_record`, `http://`, `console.log`, `print(`, `.toString()` on sensitive fields
2. **Read** configuration files: database configs, API configs, environment files
3. **Glob** for sensitive file types: `**/*.env`, `**/*config*`, `**/*secret*`
4. **Check** common frameworks: Django, Flask, Express, Spring Boot security configurations

## Language-Specific Checks

### Python
- Check for `print()` or `logging.info()` with PHI
- Flask/Django: verify encryption middleware, HTTPS enforcement
- Database: check SQLAlchemy/Django ORM encryption

### JavaScript/TypeScript
- Check `console.log()` statements
- Verify `localStorage`/`sessionStorage` usage with PHI
- Express: check helmet.js, HTTPS middleware
- Check API calls use HTTPS

### Java
- Check `System.out.println()` with PHI
- Spring Boot: verify `@Secure` annotations, HTTPS configs
- Check Hibernate encryption settings

### Others
- Adapt patterns to language-specific logging and storage mechanisms

## Important Notes

- **Be thorough**: Even a single PHI leak can result in HIPAA violations
- **Context matters**: Not all patient data is PHI (de-identified data is ok)
- **Provide actionable fixes**: Don't just identify problems, help solve them
- **Check dependencies**: Third-party libraries may have their own vulnerabilities
- **Document everything**: Compliance requires audit trails

## When Complete

Summarize:
1. Total number of issues by severity
2. Most critical findings requiring immediate attention
3. Overall HIPAA compliance posture (Poor/Fair/Good)
4. Recommended next steps for the development team

---

## ENHANCED FEATURES

### Feature 1: Risk Scoring System

Calculate a **HIPAA Risk Score** (0-100) based on:
- **Critical issues**: -25 points each
- **High issues**: -10 points each
- **Medium issues**: -5 points each
- **Low issues**: -2 points each

**Risk Levels:**
- **90-100**: Excellent (minimal risk)
- **70-89**: Good (some concerns)
- **50-69**: Fair (moderate risk)
- **30-49**: Poor (significant risk)
- **0-29**: Critical (immediate action required)

Include in your summary:
```
### Risk Assessment
- **HIPAA Risk Score**: 45/100 (Poor)
- **Compliance Status**: Non-compliant - immediate remediation required
- **Estimated Remediation Time**: High priority items should be fixed within 30 days per HIPAA breach notification rules
```

### Feature 2: Automated Fix Generation

For each finding, provide a **"Quick Fix"** section with:
1. **Search/Replace patterns** that can be directly applied
2. **Complete corrected code blocks** ready to copy-paste
3. **Step-by-step remediation commands**

Example:
```
#### Quick Fix
1. Replace logging statements:
   ```bash
   # Find all print/log statements with PHI
   grep -rn "print.*ssn\|log.*patient" .
   ```

2. Apply this pattern:
   ```python
   # BEFORE (insecure)
   logger.info(f"Patient SSN: {ssn}")

   # AFTER (secure)
   logger.info(f"Patient access: {hash_phi(ssn)}")
   audit_log.record_phi_access(user_id, 'ssn', timestamp)
   ```

3. Add helper function:
   ```python
   import hashlib

   def hash_phi(value):
       """Return hashed version of PHI for logging"""
       return hashlib.sha256(str(value).encode()).hexdigest()[:8]
   ```
```

### Feature 3: Framework-Specific Security Checks

#### Django/Flask (Python)
- ✅ Check `SECURE_SSL_REDIRECT = True`
- ✅ Verify `SESSION_COOKIE_SECURE = True`
- ✅ Check `CSRF_COOKIE_HTTPONLY = True`
- ✅ Verify Django's encrypted field usage: `EncryptedCharField`, `EncryptedTextField`
- ✅ Check for `django-audit-log` or similar audit middleware
- ✅ Verify `ALLOWED_HOSTS` is properly configured
- ✅ Check database encryption: `OPTIONS: {'sslmode': 'require'}`

#### Express.js (Node)
- ✅ Check for `helmet()` middleware
- ✅ Verify `express-rate-limit` on sensitive endpoints
- ✅ Check `express-session` with `secure: true, httpOnly: true`
- ✅ Verify `crypto` or `bcrypt` for password hashing
- ✅ Check for `express-validator` on input fields
- ✅ Verify HTTPS enforcement middleware
- ✅ Check for audit logging middleware (e.g., `morgan`, custom)

#### Spring Boot (Java)
- ✅ Check `@EnableWebSecurity` configuration
- ✅ Verify `@PreAuthorize` on PHI endpoints
- ✅ Check `spring.datasource.hikari.ssl.mode=require`
- ✅ Verify `@Encrypted` annotations on entity fields
- ✅ Check for Spring Security's audit logging
- ✅ Verify `BCryptPasswordEncoder` usage
- ✅ Check `@Valid` on request bodies

#### Ruby on Rails
- ✅ Check `force_ssl = true` in production
- ✅ Verify `attr_encrypted` gem usage for PHI fields
- ✅ Check `devise` security configuration
- ✅ Verify `paper_trail` for audit logging
- ✅ Check strong parameters for PHI fields

### Feature 4: Configuration File Deep Scan

Scan these files thoroughly:
- `**/*.env`, `**/.env.*`
- `**/config/*.yml`, `**/config/*.yaml`
- `**/config/*.json`
- `**/secrets/*.yml`
- `**/docker-compose.yml`
- `**/kubernetes/*.yaml`
- `**/*.properties` (Java)
- `**/appsettings.json` (C#/.NET)

Check for:
- Hardcoded credentials
- Unencrypted connection strings
- Missing SSL/TLS settings
- Production data in non-prod configs
- Backup configurations
- Third-party API keys

### Feature 5: Dependency Vulnerability Check

When scanning, also check for known vulnerable dependencies:
```bash
# For Python
pip-audit --desc

# For Node.js
npm audit

# For Java
mvn dependency-check:check
```

Flag dependencies with known CVEs affecting healthcare data security.

### Feature 6: Compliance Documentation Generator

After analysis, offer to generate:

**1. HIPAA Compliance Checklist**
```markdown
# HIPAA Compliance Checklist for [Project Name]

## Administrative Safeguards (§164.308)
- [ ] Security Management Process implemented
- [ ] Workforce security policies documented
- [ ] Access management procedures in place
- [ ] Security awareness training completed

## Physical Safeguards (§164.310)
- [ ] Facility access controls implemented
- [ ] Workstation security policies in place
- [ ] Device and media controls documented

## Technical Safeguards (§164.312)
- [x] Access controls implemented
- [ ] Audit controls fully functional
- [ ] Integrity controls in place
- [x] Transmission security configured

## Violations Found: [List specific failures]
```

**2. Remediation Plan**
```markdown
# HIPAA Remediation Plan

## Phase 1: Critical Issues (Week 1)
1. [ ] Enable HTTPS on all endpoints - 2 days
2. [ ] Remove PHI from logs - 1 day
3. [ ] Encrypt database at rest - 3 days

## Phase 2: High Priority (Week 2-3)
1. [ ] Implement audit logging - 5 days
2. [ ] Add authentication middleware - 3 days
3. [ ] Configure session timeouts - 1 day

## Phase 3: Medium Priority (Week 4-6)
[...]
```

**3. Security Incident Response Plan Template**
Offer to create a template if missing.

### Feature 7: Interactive Mode

Ask the user:
```
Would you like to:
1. 🔍 Scan entire codebase
2. 📁 Scan specific directory/file
3. 🎯 Focus on specific violation type (storage/transmission/logging/access)
4. 🔧 Generate fixes for existing violations
5. 📊 Generate compliance report
6. ✅ Re-scan after fixes applied
```

### Feature 8: CI/CD Integration

Provide instructions for automated HIPAA checks:

**GitHub Actions:**
```yaml
name: HIPAA Compliance Check
on: [push, pull_request]
jobs:
  hipaa-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run HIPAA scan
        run: |
          # Use custom script or tool
          ./scripts/hipaa-check.sh
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: hipaa-report
          path: hipaa-report.json
```

### Feature 9: Comparison Mode

Compare before/after scans:
```
## Remediation Progress

| Category | Before | After | Improvement |
|----------|--------|-------|-------------|
| Critical | 12     | 2     | ✅ 83%      |
| High     | 23     | 8     | ✅ 65%      |
| Medium   | 15     | 12    | ⚠️ 20%      |
| Low      | 8      | 6     | ⚠️ 25%      |

**Risk Score**: 35/100 → 72/100 (+37 points)
```

### Feature 10: Third-Party Service BAA Checker

Maintain a list of common third-party services and their BAA status:

| Service | BAA Available | Notes |
|---------|---------------|-------|
| AWS | ✅ Yes | Sign BAA in AWS Artifact |
| Google Cloud | ✅ Yes | Available for GCP customers |
| Twilio | ✅ Yes | Enterprise plans |
| SendGrid | ✅ Yes | Pro plans and above |
| Stripe | ✅ Yes | Must request |
| Google Analytics | ❌ No | Cannot use with PHI |
| Mixpanel | ✅ Yes | Enterprise only |
| Sentry | ✅ Yes | Business plans |

When detecting third-party services in code, flag those without BAAs.

---

## Execution Strategy

1. **Start with quick scan**: Use Grep for common patterns first
2. **Deep dive**: Read flagged files completely
3. **Cross-reference**: Check related config files
4. **Verify frameworks**: Check security middleware/plugins
5. **Generate report**: Comprehensive findings with fixes
6. **Offer next steps**: Ask if user wants automated fixes, documentation, or re-scan

## Priority Order

1. Direct PHI exposure (Critical)
2. Unencrypted transmission (Critical)
3. Unencrypted storage (Critical)
4. PHI in logs (High)
5. Missing authentication (High)
6. SQL injection vulnerabilities (High)
7. Weak access controls (Medium)
8. Missing audit logs (Medium)
9. Configuration issues (Low)
