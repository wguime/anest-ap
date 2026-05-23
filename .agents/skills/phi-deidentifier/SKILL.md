---
name: phi-deidentifier
description: Remove or mask PHI/PII from healthcare data using HIPAA Safe Harbor method. Use when creating test datasets, anonymizing for research, or preparing data for non-production environments.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# PHI De-identification & Data Anonymization

Remove or mask Protected Health Information (PHI) from healthcare data according to HIPAA Safe Harbor method (45 CFR § 164.514(b)(2)).

## HIPAA Safe Harbor - 18 Identifiers to Remove

### 1. Names
**What to remove:**
- Patient names (first, middle, last)
- Physician names
- Healthcare provider names
- Relative names
- Employer names

**De-identification methods:**
- **Removal:** Replace with blank or "REDACTED"
- **Pseudonymization:** Replace with fake names (Patient-001, Dr. Smith → Dr. A)
- **Tokenization:** Replace with consistent tokens (same patient = same token)

### 2. Geographic Subdivisions
**What to remove:**
- Street addresses
- City (if population < 20,000)
- County (if population < 20,000)
- ZIP codes (keep first 3 digits only)
- Latitude/longitude

**De-identification methods:**
- Keep: State, ZIP first 3 digits (if area has ≥ 20,000 people)
- Replace: Specific addresses with "City, ST" or "Region"
- Generalize: "123 Main St, Small Town" → "Northeast Region, MA"

### 3. Dates
**What to remove:**
- All dates directly related to individual (birth, admission, discharge, death, etc.)
- All ages over 89 years

**De-identification methods:**
- **Date shifting:** Shift all dates by consistent random offset (-365 to +365 days)
- **Year only:** Keep year, remove month/day
- **Age ranges:** Replace exact age with ranges (<1, 1-17, 18-64, 65-89, ≥90)
- **Relative dates:** "Days from index event" (e.g., Day 0 = admission)

### 4. Phone Numbers
**What to remove:**
- All telephone numbers
- Fax numbers

**De-identification methods:**
- **Removal:** Replace with "XXX-XXX-XXXX"
- **Fake numbers:** Use reserved ranges (555-0100 to 555-0199)
- **Format only:** Keep format, randomize digits "(XXX) XXX-XXXX"

### 5. Fax Numbers
**What to remove:** All fax numbers

**Same as phone numbers**

### 6. Email Addresses
**What to remove:** All email addresses

**De-identification methods:**
- Replace with "patient###@example.com"
- Use consistent tokens for same patient
- Remove entirely

### 7. Social Security Numbers
**What to remove:** All SSNs

**De-identification methods:**
- **Removal:** Replace with "XXX-XX-XXXX"
- **Tokenization:** Replace with unique token "SSN-TOKEN-001"
- **Hashing:** One-way hash (for research linking)

### 8. Medical Record Numbers (MRN)
**What to remove:** Medical record numbers, account numbers, certificate numbers

**De-identification methods:**
- **Replacement:** Generate new random MRNs
- **Tokenization:** MRN-001, MRN-002, etc.
- **Hashing:** For research linking (consistent across datasets)

### 9. Health Plan Numbers
**What to remove:** Insurance member IDs, policy numbers, group numbers

**De-identification methods:**
- Replace with "INSURANCE-001"
- Use generic placeholders
- Remove entirely

### 10. Device Identifiers & Serial Numbers
**What to remove:**
- Pacemaker serial numbers
- Insulin pump IDs
- Medical device identifiers
- Implant serial numbers

**De-identification methods:**
- Replace with "DEVICE-###"
- Remove entirely
- Keep device type only (remove serial)

### 11. Web URLs
**What to remove:**
- Personal websites
- Patient portal URLs with tokens
- URLs containing PHI

**De-identification methods:**
- Remove query parameters
- Replace with generic URLs
- Remove entirely

### 12. IP Addresses
**What to remove:** All IP addresses (v4 and v6)

**De-identification methods:**
- Replace with "0.0.0.0" or "REDACTED"
- Keep network portion only (192.168.X.X)
- Remove entirely

### 13. Biometric Identifiers
**What to remove:**
- Fingerprints
- Voice recordings
- Retinal scans
- Facial photographs
- DNA sequences

**De-identification methods:**
- Remove image files
- Redact biometric data fields
- Remove references to biometric IDs

### 14. Full Face Photos
**What to remove:**
- Photographs of face
- Comparable images

**De-identification methods:**
- Remove image files
- Blur faces in images
- Replace with generic silhouettes
- Remove image references from data

### 15. Other Unique Identifiers
**What to remove:**
- Driver's license numbers
- Passport numbers
- State ID numbers
- Veteran ID numbers
- Student ID numbers

**De-identification methods:**
- Replace with generic tokens
- Remove entirely
- Hash for research purposes

### 16. Vehicle Identifiers
**What to remove:**
- License plate numbers
- VIN numbers

**De-identification methods:**
- Replace with "LICENSE-REDACTED"
- Remove entirely

### 17. URLs & Identifiers
**What to remove:** Any other unique identifying numbers or codes

**De-identification methods:**
- Review and remove/mask
- Apply tokenization

### 18. Ages Over 89
**What to remove:** All elements of dates and ages over 89

**De-identification methods:**
- Replace with "≥90" or "90+"
- Aggregate into ≥90 age group
- Remove exact age and DOB

## De-identification Strategies

### Strategy 1: Complete Removal (Safe Harbor Compliant)
Remove all 18 identifiers completely. Safest method, but reduces data utility.

**Use when:**
- Public dataset release
- Minimal risk tolerance
- Data utility not critical

**Example:**
```
BEFORE: John Smith, DOB 03/15/1955, SSN 123-45-6789
AFTER: [REDACTED], [REDACTED], [REDACTED]
```

### Strategy 2: Pseudonymization (Recommended)
Replace identifiers with consistent fake values. Maintains data relationships.

**Use when:**
- Need to track patients across records
- Research studies
- Analytics requiring patient-level data

**Example:**
```
BEFORE: John Smith, DOB 03/15/1955, MRN ABC12345
AFTER: Patient-001, 1955, MRN-001
(All John Smith's records use Patient-001)
```

### Strategy 3: Date Shifting
Shift all dates by consistent random offset per patient.

**Use when:**
- Temporal relationships matter
- Research studies
- Preserving day-of-week effects

**Example:**
```
Patient A: Shift by +47 days
  Admission: 2024-01-15 → 2024-03-03
  Discharge: 2024-01-20 → 2024-03-08
  (5-day stay preserved)
```

### Strategy 4: Generalization
Replace specific values with broader categories.

**Use when:**
- Need demographic data
- Statistical analysis
- Reducing granularity acceptable

**Example:**
```
BEFORE: ZIP 02139, Age 47, DOB 1976-05-15
AFTER: ZIP 021XX, Age Group 45-54, Year 1976
```

### Strategy 5: Synthetic Data Replacement
Replace with realistic but fake data.

**Use when:**
- Creating test environments
- Demo/training data
- Preserving data patterns

**Example:**
```
BEFORE: John Smith, 555-1234, john@email.com
AFTER: Jane Doe, 555-0123, jane.doe@example.com
(Realistic but completely fabricated)
```

## De-identification Process

### Phase 1: Discovery
1. **Scan codebase/data files** for PHI using pattern matching:
   - Grep for SSN patterns: `\d{3}-\d{2}-\d{4}`
   - Grep for phone: `\(\d{3}\) \d{3}-\d{4}` or `\d{3}-\d{3}-\d{4}`
   - Grep for email: `\S+@\S+\.\S+`
   - Grep for dates: `\d{2}/\d{2}/\d{4}` or `\d{4}-\d{2}-\d{2}`
   - Grep for MRN: common patterns like `MRN\d+`, `#\d{6,}`

2. **Identify field types** in structured data:
   - CSV column names: "ssn", "social_security", "patient_name", "dob"
   - JSON keys: "patientName", "dateOfBirth", "phoneNumber"
   - Database columns from schema files

3. **Catalog PHI locations:**
   - Source code (test data, examples, comments)
   - Configuration files
   - Database exports
   - Log files
   - Documentation
   - Images/PDFs

### Phase 2: Strategy Selection
Ask user:
```
Select de-identification strategy:

1. Safe Harbor Compliance (Complete removal)
   - Removes all 18 identifiers
   - HIPAA compliant
   - Reduces data utility

2. Pseudonymization (Recommended)
   - Consistent fake identifiers
   - Maintains relationships
   - Good for testing/research

3. Date Shifting
   - Shifts dates by random offset
   - Preserves temporal patterns
   - Good for time-series analysis

4. Generalization
   - Broader categories (age ranges, ZIP prefixes)
   - Preserves demographics
   - Good for statistical analysis

5. Synthetic Data Generation
   - Completely fake but realistic data
   - Highest utility
   - Good for development/testing

6. Custom (specify your requirements)

Choose (1-6):
```

### Phase 3: Transformation Rules

#### For CSV/TSV Files:
```python
import pandas as pd
import hashlib
from datetime import timedelta
import random

def deidentify_csv(input_file, output_file, strategy='pseudonymize'):
    df = pd.read_csv(input_file)

    # Generate consistent patient tokens
    patient_map = {}
    def get_patient_token(name):
        if name not in patient_map:
            patient_map[name] = f"Patient-{len(patient_map) + 1:04d}"
        return patient_map[name]

    # De-identify columns
    if 'patient_name' in df.columns:
        df['patient_name'] = df['patient_name'].apply(get_patient_token)

    if 'ssn' in df.columns:
        df['ssn'] = 'XXX-XX-XXXX'

    if 'date_of_birth' in df.columns:
        # Keep year only
        df['date_of_birth'] = pd.to_datetime(df['date_of_birth']).dt.year

    if 'phone' in df.columns:
        df['phone'] = '555-0100'

    if 'email' in df.columns:
        df['email'] = df.apply(lambda row: f"patient{row.name}@example.com", axis=1)

    # Date shifting (consistent per patient)
    date_columns = [col for col in df.columns if 'date' in col.lower()]
    shift_days = random.randint(-365, 365)
    for col in date_columns:
        df[col] = pd.to_datetime(df[col]) + timedelta(days=shift_days)

    df.to_csv(output_file, index=False)
    return df
```

#### For JSON/FHIR Files:
```python
import json

def deidentify_fhir_bundle(bundle):
    """De-identify FHIR bundle"""
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        resource_type = resource.get('resourceType')

        if resource_type == 'Patient':
            # Remove names
            if 'name' in resource:
                resource['name'] = [{'text': 'REDACTED'}]

            # Generalize birthDate
            if 'birthDate' in resource:
                birth_year = resource['birthDate'][:4]
                resource['birthDate'] = birth_year

            # Remove telecom
            if 'telecom' in resource:
                del resource['telecom']

            # Remove addresses
            if 'address' in resource:
                resource['address'] = [{'state': addr.get('state', 'XX')}
                                       for addr in resource['address']]

            # Remove identifiers (SSN, MRN)
            if 'identifier' in resource:
                resource['identifier'] = []

    return bundle
```

#### For Source Code:
```python
# Replace hardcoded test data
def deidentify_source_code(file_path):
    """Remove PHI from source code"""

    replacements = {
        # SSN patterns
        r'\d{3}-\d{2}-\d{4}': 'XXX-XX-XXXX',
        # Phone patterns
        r'\(\d{3}\) \d{3}-\d{4}': '(555) 555-0100',
        # Email patterns (preserve domain structure)
        r'[\w\.-]+@[\w\.-]+': 'user@example.com',
        # Names in test data
        r'"firstName":\s*"[^"]*"': '"firstName": "Test"',
        r'"lastName":\s*"[^"]*"': '"lastName": "Patient"',
    }

    with open(file_path, 'r') as f:
        content = f.read()

    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)

    return content
```

### Phase 4: Validation
After de-identification:
1. **Verify no PHI remains:**
   - Re-run pattern matching
   - Manual spot checks
   - Automated PHI detection tools

2. **Validate data integrity:**
   - Record counts unchanged
   - Relationships preserved (if pseudonymized)
   - Data types consistent
   - No null/empty values introduced

3. **Check utility:**
   - Can still perform required analysis?
   - Temporal relationships preserved?
   - Statistical properties maintained?

### Phase 5: Documentation
Generate de-identification report:
```markdown
# De-identification Report

## Summary
- **Date:** 2026-03-06
- **Strategy:** Pseudonymization with date shifting
- **Files processed:** 5
- **Records de-identified:** 1,523

## Transformations Applied

### Identifiers Removed/Masked:
- ✅ Patient names → Pseudonyms (Patient-0001, Patient-0002)
- ✅ SSN → XXX-XX-XXXX
- ✅ Phone numbers → 555-0100 to 555-0199
- ✅ Email addresses → patient###@example.com
- ✅ Street addresses → Removed (kept city, state)
- ✅ ZIP codes → First 3 digits only
- ✅ MRN → Tokenized (MRN-0001, MRN-0002)
- ✅ Dates → Shifted by +127 days (consistent per patient)
- ✅ Ages >89 → Replaced with "90+"

### Data Preserved:
- ✓ Patient relationships (same patient = same pseudonym)
- ✓ Temporal relationships (date intervals preserved)
- ✓ Geographic region (state level)
- ✓ Demographic patterns (age groups, gender)
- ✓ Clinical data (diagnoses, procedures, lab values)

## Validation Results
- PHI patterns found: 0 ✅
- Data integrity check: PASSED ✅
- Record count: 1,523 (unchanged) ✅

## Files Generated
- patients_deidentified.csv (1,523 records)
- encounters_deidentified.csv (3,456 records)
- lab_results_deidentified.csv (12,345 records)

## Compliance
✅ HIPAA Safe Harbor compliant (45 CFR § 164.514(b)(2))
✅ All 18 identifiers addressed
✅ No residual PHI detected
```

## Advanced Features

### Feature 1: Consistency Across Datasets
Maintain consistent pseudonyms across multiple files:
- Same patient name → Same pseudonym in all files
- Same date → Same shifted date in all files
- Use master mapping file (encrypted)

### Feature 2: Reversible De-identification (Enterprise)
For organizations needing to re-identify:
- Store encryption keys in secure key management
- Tokenization server maintains mappings
- Audit all re-identification events
- **NOT Safe Harbor compliant** - expert determination required

### Feature 3: Smart PHI Detection
Use pattern recognition and context:
- NLP to identify names in free text
- Context-aware detection (Dr. before name)
- Medical entity recognition
- Confidence scoring

### Feature 4: Synthetic Data Generation
Generate realistic fake data preserving statistical properties:

```python
from faker import Faker
import numpy as np

fake = Faker()

def generate_synthetic_patient(original):
    """Generate synthetic patient preserving demographics"""
    return {
        'name': fake.name(),
        'dob': fake.date_of_birth(minimum_age=original.age-5, maximum_age=original.age+5),
        'gender': original.gender,  # Preserve
        'zip': original.zip[:3] + '00',  # Preserve region
        'diagnosis': original.diagnosis,  # Preserve clinical
    }
```

### Feature 5: Partial De-identification
For internal use (not Safe Harbor):
- Keep identifiers for authorized users
- Mask for unauthorized users
- Role-based de-identification
- Field-level access control

### Feature 6: De-identification Templates
Pre-built templates for common scenarios:
- **Research dataset:** Pseudonyms, date shifting, ZIP truncation
- **Test environment:** Synthetic data, fake names/SSNs
- **Analytics:** Generalization, age ranges, broad geography
- **Public release:** Complete Safe Harbor removal

## Special Cases

### Free Text / Clinical Notes
Clinical notes are challenging - contain narrative PHI:

```
ORIGINAL NOTE:
"Patient John Smith (DOB 3/15/1955) presented on 1/10/2024 complaining of chest pain.
He lives at 123 Main St, Boston, MA 02139. Contact: 617-555-1234."

DE-IDENTIFIED NOTE:
"Patient [PATIENT-001] (DOB [YEAR-1955]) presented on [DATE-001] complaining of chest pain.
He lives in [CITY], MA [ZIP-021XX]. Contact: [PHONE]."
```

Methods:
- Named Entity Recognition (NER) to find PHI
- Regular expression patterns
- Manual review for complex cases
- Template-based redaction

### Images / PDFs
- Redact faces in images (facial recognition + blurring)
- Remove DICOM headers with PHI
- Redact text in PDF documents
- Remove metadata (EXIF, PDF properties)

### Database De-identification
Full database anonymization:

```sql
-- Pseudonymize patient names
UPDATE patients
SET
  first_name = CONCAT('Patient-', LPAD(id, 4, '0')),
  last_name = 'Anonymous',
  ssn = 'XXX-XX-XXXX',
  phone = '555-0100',
  email = CONCAT('patient', id, '@example.com');

-- Date shifting (consistent per patient)
UPDATE encounters e
JOIN (
  SELECT patient_id, FLOOR(RAND() * 730 - 365) as shift_days
  FROM patients
) shifts ON e.patient_id = shifts.patient_id
SET
  e.admission_date = DATE_ADD(e.admission_date, INTERVAL shifts.shift_days DAY),
  e.discharge_date = DATE_ADD(e.discharge_date, INTERVAL shifts.shift_days DAY);

-- Generalize ZIP codes
UPDATE patients
SET zip_code = CONCAT(LEFT(zip_code, 3), '00');
```

## Output Options

Ask user what output they need:

```
Select output format:

1. In-place modification (overwrite original files)
   ⚠️ WARNING: Irreversible without backup

2. New files (add _deidentified suffix)
   ✓ Recommended: Preserves originals

3. Separate directory (deidentified/)
   ✓ Recommended: Clean organization

4. Preview only (show transformations, don't write)
   ✓ Safe: Review before applying

5. Generate code (provide de-identification scripts)
   ✓ Custom: Run transformations yourself

Choose (1-5):
```

## Quality Assurance

After de-identification, verify:
1. **No PHI remains** - Run PHI detection scan
2. **Data utility preserved** - Test key analytics still work
3. **Consistency maintained** - Same entities have same pseudonyms
4. **Format valid** - Files still parse correctly
5. **Audit trail** - Document what was changed

## Legal Compliance

### HIPAA Safe Harbor Requirements
✅ All 18 identifiers removed OR
✅ Expert determination that re-identification risk is very small

### Additional Considerations
- **State laws:** Some states have stricter requirements
- **IRB approval:** Research may need institutional review
- **Data use agreements:** Terms for sharing de-identified data
- **Re-identification prohibition:** Recipients cannot attempt re-identification

### Limitations
**De-identified data is NOT:**
- 100% anonymous (re-identification theoretically possible)
- Protected by HIPAA after de-identification
- Suitable for all purposes (may lose data utility)

## When Complete

Provide:
1. Summary of transformations applied
2. Validation that no PHI remains
3. Before/after examples (if safe to show)
4. Generated de-identified files
5. De-identification report for documentation
6. Recommendations for data use

Offer to:
- Run HIPAA compliance check on de-identified data
- Generate synthetic test data
- Create de-identification pipeline/scripts
- Validate data quality after de-identification
