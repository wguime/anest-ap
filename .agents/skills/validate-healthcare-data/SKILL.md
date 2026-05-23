---
name: validate-healthcare-data
description: Comprehensive data quality validation for healthcare datasets. Use when validating patient records, medical codes, insurance data, or preparing healthcare data for production.
allowed-tools: Read, Grep, Glob, Bash
---

# Healthcare Data Quality Validator

Perform comprehensive data quality validation on healthcare datasets including patient demographics, medical codes, lab values, and insurance information.

## Validation Categories

### 1. Patient Demographics Validation

#### Name Validation
- **Check for:** Empty names, special characters, numeric values, excessive length
- **Valid patterns:** Letters, spaces, hyphens, apostrophes only
- **Flag:** Names with numbers, URLs, email addresses
- **Minimum length:** First name ≥ 2 chars, Last name ≥ 2 chars
- **Maximum length:** ≤ 50 chars each

#### Date of Birth Validation
- **Check for:** Future dates, unrealistic ages (>120 years old, <0)
- **Format validation:** YYYY-MM-DD, MM/DD/YYYY, ISO 8601
- **Flag:** Missing DOB, invalid dates (Feb 30, etc.)
- **Age calculation:** Verify age is reasonable for context

#### Address Validation
- **Check for:** Missing required fields (street, city, state, zip)
- **US ZIP validation:** 5-digit or ZIP+4 format (12345 or 12345-6789)
- **State codes:** Valid 2-letter state abbreviations
- **Flag:** PO Box restrictions if applicable, international addresses

#### Contact Information
- **Phone validation:**
  - US: (XXX) XXX-XXXX or XXX-XXX-XXXX format
  - Must be 10 digits
  - Flag: Invalid area codes (000, 555 except for testing)
- **Email validation:** RFC 5322 compliant format
- **Flag:** Disposable email domains, obviously fake emails (test@test.com)

#### SSN Validation
- **Format:** XXX-XX-XXXX (9 digits)
- **Flag:** Invalid SSNs:
  - All zeros: 000-00-0000
  - Sequential: 123-45-6789
  - Repeated: 111-11-1111
  - Invalid area numbers: 000, 666, 900-999
  - Advertising SSNs: 219-09-9999 (Woolworth's card)

#### Gender/Sex Validation
- **Valid values:** M, F, Male, Female, Other, Unknown, U
- **Flag:** Empty, numeric, invalid codes

### 2. Medical Code Validation

#### ICD-10 Diagnosis Codes
- **Format validation:**
  - Letter + 2 digits (minimum): A00
  - Up to 7 characters: A00.0000
  - Valid chapter letters: A-Z (except U reserved)
- **Structure checks:**
  - Decimal after 3rd character
  - Valid chapter ranges (A00-Z99)
- **Flag:**
  - Invalid codes not in ICD-10-CM
  - Outdated codes
  - Unspecified codes overuse (*.9)
  - Missing laterality when required

#### CPT Procedure Codes
- **Format:** 5-digit numeric codes
- **Valid ranges:**
  - Category I: 00100-99499
  - Category II: 0001F-9999F (performance measures)
  - Category III: 0001T-9999T (emerging technology)
- **Flag:**
  - Invalid code numbers
  - Deleted codes
  - Gender-specific mismatches
  - Age-specific mismatches

#### HCPCS Codes
- **Level II format:** Letter + 4 digits (A0000-V9999)
- **Valid ranges:** A-V codes
- **Flag:** Invalid ranges, expired codes

#### LOINC Lab Codes
- **Format:** 5-6 digit numeric + optional -X
- **Structure:** XXXXX-X format
- **Validate:** Code exists in LOINC database
- **Check:** Appropriate for specimen type

#### SNOMED CT Codes
- **Format:** Numeric codes (typically 6-18 digits)
- **Validate:** Code exists and is active
- **Check:** Appropriate hierarchy and relationships

### 3. Lab Values & Vitals Validation

#### Vital Signs Ranges (Adult)
- **Blood Pressure:**
  - Systolic: 70-250 mmHg (warn if <90 or >140)
  - Diastolic: 40-150 mmHg (warn if <60 or >90)
  - Flag: Systolic < Diastolic (impossible)
- **Heart Rate:** 40-200 bpm (warn if <60 or >100)
- **Respiratory Rate:** 8-40 breaths/min (warn if <12 or >20)
- **Temperature:**
  - Celsius: 35-42°C (warn if <36.5 or >37.5)
  - Fahrenheit: 95-107.6°F (warn if <97.7 or >99.5)
- **Oxygen Saturation:** 70-100% (critical if <90%)
- **Weight:**
  - Adult: 30-300 kg (66-660 lbs)
  - Flag: Impossible values, unit inconsistencies
- **Height:**
  - Adult: 100-250 cm (39-98 inches)
  - Flag: Pediatric measurements in adult records

#### Common Lab Values (Adult)
- **Glucose:**
  - Fasting: 70-100 mg/dL (normal)
  - Random: 70-140 mg/dL
  - Critical: <40 or >400 mg/dL
- **Hemoglobin:**
  - Male: 13.5-17.5 g/dL
  - Female: 12.0-15.5 g/dL
  - Critical: <7 or >20 g/dL
- **WBC:** 4,000-11,000 cells/μL (critical if <1,000 or >30,000)
- **Platelets:** 150,000-400,000 /μL (critical if <50,000)
- **Creatinine:** 0.6-1.2 mg/dL (renal function)
- **BUN:** 7-20 mg/dL
- **Sodium:** 135-145 mEq/L (critical if <120 or >160)
- **Potassium:** 3.5-5.0 mEq/L (critical if <2.5 or >6.0)

**Validation:**
- Flag values outside physiologic ranges
- Check units consistency (mg/dL vs mmol/L)
- Verify gender-specific ranges
- Flag missing units
- Check specimen type matches test

### 4. Insurance Information Validation

#### Insurance ID/Member ID
- **Check:** Not empty, reasonable length (5-20 characters)
- **Format:** Alphanumeric, may include hyphens
- **Flag:** Obviously fake (123456, TEST, NONE)

#### Group Number
- **Validate:** Present when required (employer insurance)
- **Format:** Alphanumeric

#### Payer Information
- **Validate:** Payer name exists in payer list
- **Check:** Payer ID format (5-digit NAIC code or other)
- **Flag:** Missing payer information

#### Insurance Type
- **Valid values:** Commercial, Medicare, Medicaid, Self-Pay, Other
- **Flag:** Empty or invalid types

#### Coverage Dates
- **Start date:** Must be in past or today
- **End date:** Must be after start date (if present)
- **Flag:** Active coverage with end date in past

### 5. Data Completeness Checks

#### Required Fields by Context
**Inpatient:**
- Patient name, DOB, MRN
- Admission date/time
- Attending physician
- Primary diagnosis
- Room/bed assignment

**Outpatient:**
- Patient name, DOB, MRN
- Appointment date/time
- Provider
- Chief complaint or diagnosis

**Lab Order:**
- Patient name, DOB, MRN
- Order date/time
- Ordering provider
- Test code (LOINC)
- Specimen type

#### Completeness Scoring
- Calculate % of required fields populated
- Calculate % of optional fields populated
- Flag records with <80% required field completion

### 6. Data Consistency Checks

#### Cross-Field Validation
- **Gender-specific procedures:** Flag mismatches (pregnancy in male patient)
- **Age-appropriate codes:** Flag pediatric codes in adults, geriatric in children
- **Date sequences:** Discharge date after admission, death date after birth
- **Medication dosing:** Age/weight appropriate doses

#### Duplicate Detection
- **Exact duplicates:** Same MRN + same encounter date
- **Fuzzy duplicates:**
  - Similar names (Levenshtein distance < 2)
  - Same DOB + similar name
  - Same phone + similar name
- **Flag for review:** Potential duplicate patients

### 7. Format & Encoding Issues

#### Character Encoding
- **Check for:** Non-UTF-8 characters, mojibake
- **Flag:** Special characters that may cause issues (null bytes, control chars)

#### Date/Time Formats
- **Standardize:** Check for consistent date formats across dataset
- **Timezone:** Verify timezone information present and consistent
- **Flag:** Ambiguous dates (02/03/2024 - US vs EU format?)

#### Delimiter Issues (CSV/TSV)
- **Check:** Fields with unescaped delimiters
- **Validate:** Consistent column counts per row
- **Flag:** Embedded newlines, quote issues

## Validation Process

### 1. Initial Scan
Use Glob to identify healthcare data files:
- CSV/TSV files
- JSON files (FHIR bundles, etc.)
- Database export files
- Excel files (if accessible)

### 2. Data Profiling
For each dataset:
1. **Count records:** Total rows
2. **Identify fields:** Column names and data types
3. **Calculate statistics:**
   - Null/empty rates per field
   - Unique value counts
   - Min/max values for numeric fields
   - Common patterns for text fields

### 3. Validation Execution
Run all applicable validation rules based on detected field types:
- Demographics validation
- Medical code validation
- Lab values validation
- Insurance validation
- Completeness checks
- Consistency checks

### 4. Scoring System

Calculate **Data Quality Score (0-100)**:
- **Validity (40 points):** % of records with valid values
- **Completeness (25 points):** % of required fields populated
- **Consistency (20 points):** % of records passing cross-field checks
- **Accuracy (15 points):** % of medical codes valid

**Quality Levels:**
- **90-100:** Excellent - Production ready
- **75-89:** Good - Minor cleanup needed
- **60-74:** Fair - Moderate issues
- **40-59:** Poor - Significant problems
- **0-39:** Critical - Major data quality issues

## Output Format

```markdown
# HEALTHCARE DATA QUALITY REPORT

## Executive Summary
- **Overall Quality Score:** 72/100 (Fair)
- **Records Analyzed:** 1,523
- **Files Processed:** 3
- **Critical Issues:** 45
- **Warnings:** 234
- **Total Issues:** 279

## Quality Score Breakdown
- Validity: 35/40 (87.5%)
- Completeness: 18/25 (72%)
- Consistency: 14/20 (70%)
- Accuracy: 11/15 (73%)

---

## CRITICAL ISSUES (Immediate Action Required)

### 1. Invalid ICD-10 Codes
**Severity:** Critical
**Count:** 23 records
**File:** patients_diagnoses.csv

**Examples:**
| Row | Patient MRN | Code | Issue |
|-----|-------------|------|-------|
| 145 | MRN001234 | A999.99 | Invalid ICD-10 code |
| 289 | MRN005678 | E1100000 | Code too long (max 7 chars) |
| 456 | MRN009012 | DIABETES | Text instead of code |

**Impact:** Claims will be rejected, billing delays

**Remediation:**
- Review and correct invalid codes
- Use ICD-10-CM code lookup tool
- Train staff on proper code entry

---

### 2. Missing Required Demographics
**Severity:** Critical
**Count:** 18 records

**Details:**
- 12 records missing Date of Birth
- 6 records missing patient name
- 3 records missing both

**Impact:** Cannot process or identify patients

**Remediation:**
- Contact patients for missing information
- Review intake forms and processes

---

## WARNINGS (Should Be Fixed)

### 3. Unrealistic Vital Signs
**Severity:** High
**Count:** 67 records

**Examples:**
| Row | Patient | Value | Issue |
|-----|---------|-------|-------|
| 234 | MRN002345 | BP: 250/180 | Extremely high BP |
| 456 | MRN003456 | Temp: 105.3°F | High fever (verify) |
| 789 | MRN004567 | HR: 220 bpm | Tachycardia (verify) |

**Action:** Review for data entry errors or true critical values

---

## DATA QUALITY METRICS

### Completeness by Field
| Field | Populated | Missing | Rate |
|-------|-----------|---------|------|
| Patient Name | 1,505 | 18 | 98.8% |
| DOB | 1,511 | 12 | 99.2% |
| Primary Diagnosis | 1,489 | 34 | 97.8% |
| Insurance ID | 1,234 | 289 | 81.0% ⚠️ |
| Email | 890 | 633 | 58.4% ⚠️ |

### Duplicate Detection
- **Exact duplicates:** 5 found
- **Potential duplicates:** 12 pairs flagged for review
- **Action:** Review and merge duplicate records

### Code Validity
| Code Type | Valid | Invalid | Rate |
|-----------|-------|---------|------|
| ICD-10 | 1,489 | 34 | 97.7% |
| CPT | 2,345 | 23 | 99.0% |
| LOINC | 456 | 12 | 97.4% |

---

## RECOMMENDATIONS

### Immediate Actions (This Week)
1. Fix 23 invalid ICD-10 codes
2. Obtain missing demographics for 18 patients
3. Verify 67 extreme vital signs readings
4. Review and merge 5 duplicate records

### Short-Term Improvements (This Month)
1. Improve insurance data collection (81% → 95% target)
2. Implement real-time validation at data entry
3. Train staff on medical code entry
4. Establish data quality monitoring

### Long-Term Initiatives (This Quarter)
1. Integrate with medical code validation API
2. Implement automated duplicate detection
3. Create data quality dashboards
4. Establish data governance policies

---

## DETAILED VALIDATION RESULTS

[Include row-by-row validation results if requested]

---

**Report Generated:** 2026-03-06
**Validation Tool:** Healthcare Data Quality Validator v1.0
**Standards:** ICD-10-CM 2024, CPT 2024, LOINC 2.76
```

## Special Validations

### Pediatric Considerations
When age < 18 years:
- Use pediatric vital signs ranges
- Flag adult-only procedures
- Check guardian/parent information
- Verify immunization records

### Pregnancy-Related
For pregnant patients:
- Validate gestational age (0-42 weeks)
- Check prenatal visit schedule
- Verify OB-specific codes (O00-O9A)
- Validate delivery codes consistency

### Medicare/Medicaid Specific
- Validate Medicare number format (1-12 alphanumeric)
- Check Medicare eligibility age (≥65 or disability)
- Validate Medicaid ID format by state

## Advanced Features

### 1. Anomaly Detection
Use statistical methods to detect outliers:
- Values outside 3 standard deviations
- Unusual patterns (all lab values ending in 0)
- Temporal anomalies (sudden data quality drops)

### 2. Data Quality Trends
Track quality metrics over time:
- Weekly/monthly quality scores
- Improvement tracking
- Regression detection

### 3. Automated Remediation Suggestions
For common issues, suggest SQL/Python fixes:

```sql
-- Fix common SSN format issues
UPDATE patients
SET ssn = REPLACE(REPLACE(ssn, ' ', ''), '.', '')
WHERE ssn LIKE '% %' OR ssn LIKE '%.%';

-- Standardize phone numbers
UPDATE patients
SET phone = REGEXP_REPLACE(phone, '[^0-9]', '')
WHERE phone IS NOT NULL;
```

### 4. Comparative Analysis
Compare dataset quality against:
- Historical baselines
- Industry benchmarks
- Similar organizations

## Integration Points

### Export Formats
- JSON (for programmatic use)
- CSV (for spreadsheet analysis)
- HTML (for web viewing)
- PDF (for reports)

### API Integration
Suggest integration with:
- Medical code validation APIs (CMS, Codify)
- Address validation services (USPS, SmartyStreets)
- Duplicate detection services

## Execution Strategy

1. **Quick Scan Mode** (< 1 minute)
   - Basic format checks
   - Required field validation
   - Critical value ranges

2. **Standard Validation** (1-5 minutes)
   - All validation rules
   - Duplicate detection
   - Statistical analysis

3. **Deep Validation** (5-30 minutes)
   - External API verification
   - Fuzzy matching
   - Advanced analytics

Ask user which mode to run, or auto-select based on dataset size.

## Important Notes

- **Context matters:** Validation rules may vary by:
  - Healthcare setting (hospital, clinic, lab)
  - Patient population (pediatric, geriatric, specialty)
  - Data source (EHR, claims, registry)
  - Regional requirements (state-specific codes)

- **Standards version:** Always note which code set versions used
  - ICD-10-CM year
  - CPT year
  - LOINC version

- **False positives:** Some "invalid" data may be legitimate edge cases
  - Extreme vital signs may be real critical values
  - Unusual codes may be valid but rare
  - Always recommend manual review for critical findings

## When Complete

Provide:
1. Overall quality score and assessment
2. Count of issues by severity
3. Top 5 most critical problems
4. Specific remediation steps
5. Offer to generate detailed report or export results
