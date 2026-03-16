# Staff Schedule Testing Checklist

## Overview

This checklist covers all aspects of testing the staff schedule feature implementation, including components, integrations, dark mode, and responsive behavior.

---

## 1. Component Testing

### StaffScheduleCard Component

**Location:** `/Users/guilherme/Documents/IA/Qmentum/versão-2.0/web/src/design-system/components/anest/staff-schedule-card.jsx`

- [ ] **Basic Rendering**
  - [ ] Card displays with title prop
  - [ ] Sections render correctly with labels
  - [ ] Staff items display with nome, turno, and funcoes
  - [ ] Empty state shows when no sections provided

- [ ] **Section Variants**
  - [ ] `default` variant displays with correct styling
  - [ ] `warning` variant displays with amber/yellow accent
  - [ ] `success` variant displays with green accent
  - [ ] Section icons render correctly (Sun, Moon, etc.)

- [ ] **Item Status**
  - [ ] `normal` status displays with default styling
  - [ ] `destaque` status displays with highlighted background
  - [ ] `alerta` status displays with warning colors

- [ ] **Interactive Elements**
  - [ ] Edit button appears when `canEdit={true}`
  - [ ] Edit button hidden when `canEdit={false}`
  - [ ] Edit button onClick triggers correctly
  - [ ] Card is accessible (keyboard navigation, ARIA labels)

- [ ] **Edge Cases**
  - [ ] Empty sections array displays appropriate message
  - [ ] Section with no items handles gracefully
  - [ ] Very long staff names truncate properly
  - [ ] Multiple sections display without layout breaks

### StaffListItem Component

**Location:** `/Users/guilherme/Documents/IA/Qmentum/versão-2.0/web/src/design-system/components/anest/staff-list-item.jsx`

- [ ] **Basic Rendering**
  - [ ] Displays staff name correctly
  - [ ] Displays turno (shift) information
  - [ ] Displays funcoes (role/location) information
  - [ ] User icon renders

- [ ] **Status Variants**
  - [ ] `normal` status uses default colors
  - [ ] `destaque` status uses highlighted background
  - [ ] `alerta` status uses warning colors

- [ ] **Dark Mode**
  - [ ] Colors adapt correctly in dark mode
  - [ ] Text remains readable
  - [ ] Background colors have proper contrast

---

## 2. Integration Testing

### HomePage Integration

**Location:** `/Users/guilherme/Documents/IA/Qmentum/versão-2.0/web/src/pages/HomePage.jsx`

- [ ] **Import Verification**
  - [ ] `StaffScheduleCard` imports correctly from `@/design-system`
  - [ ] `useStaff` hook imports correctly from hooks
  - [ ] No console errors on page load

- [ ] **Data Loading**
  - [ ] Staff data loads from Firestore successfully
  - [ ] Loading state displays skeleton/spinner
  - [ ] Error state handles gracefully
  - [ ] Mock data displays when `USE_MOCK = true`

- [ ] **Schedule Display**
  - [ ] Current day is calculated correctly
  - [ ] Hospital staff sections display (manhã, tarde, plantão 24h)
  - [ ] Consultório staff displays if applicable
  - [ ] Staff limited to 3 per section as designed

- [ ] **Mock Data Indicator**
  - [ ] Mock data warning displays when using mock data
  - [ ] "Ver todos" link navigates to Centro de Gestão
  - [ ] Warning hidden when using real Firestore data

### Centro de Gestão Integration (if applicable)

**Location:** `/Users/guilherme/Documents/IA/Qmentum/versão-2.0/web/src/pages/CentroDeGestao.jsx`

- [ ] **Tab Navigation**
  - [ ] Funcionários tab exists
  - [ ] Tab switches correctly
  - [ ] URL param `?tab=funcionarios` works

- [ ] **Full Staff View**
  - [ ] All staff members display (not limited to 3)
  - [ ] Filtering by day works
  - [ ] Filtering by location works
  - [ ] Edit functionality available for admins

### useStaff Hook

**Location:** `/Users/guilherme/Documents/IA/Qmentum/versão-2.0/web/src/hooks/useStaff.js`

- [ ] **Data Fetching**
  - [ ] Fetches data from Firestore `staff` collection
  - [ ] Falls back to mock data when collection is empty
  - [ ] Handles network errors gracefully
  - [ ] Real-time updates work (if implemented)

- [ ] **Helper Functions**
  - [ ] `getHospitalStaffByDay(day)` returns correct staff
  - [ ] `getConsultorioByDay(day)` returns correct staff
  - [ ] Day name mapping works (segunda, terca, etc.)
  - [ ] Filters inactive staff correctly

- [ ] **Permissions**
  - [ ] `canEdit` reflects user permissions correctly
  - [ ] Admins have edit access
  - [ ] Non-admins cannot edit

---

## 3. Dark Mode Testing

- [ ] **StaffScheduleCard Dark Mode**
  - [ ] Card background uses dark theme color
  - [ ] Border color adapts to dark mode
  - [ ] Text colors remain readable (white/light gray)
  - [ ] Section headers readable in dark mode
  - [ ] Edit button icon color adapts

- [ ] **StaffListItem Dark Mode**
  - [ ] Background colors use dark theme
  - [ ] Text colors have proper contrast
  - [ ] Status badges readable in dark mode
  - [ ] Hover states work correctly

- [ ] **Toggle Testing**
  - [ ] Toggle dark mode on/off multiple times
  - [ ] No visual glitches during transition
  - [ ] Colors consistent across all staff components

---

## 4. Responsive Behavior Testing

### Mobile (320px - 480px)

- [ ] **StaffScheduleCard**
  - [ ] Card width adapts to small screens
  - [ ] Padding/margins appropriate for mobile
  - [ ] Text doesn't overflow or wrap awkwardly
  - [ ] Edit button accessible (not too small)

- [ ] **StaffListItem**
  - [ ] Item layout stacks properly
  - [ ] Icons and text align correctly
  - [ ] No horizontal scrolling required
  - [ ] Touch targets minimum 44x44px

### Tablet (481px - 1024px)

- [ ] **Layout**
  - [ ] Card uses available width effectively
  - [ ] Multiple sections display side-by-side if applicable
  - [ ] No wasted whitespace

### Desktop (1025px+)

- [ ] **Layout**
  - [ ] Card max-width prevents excessive stretching
  - [ ] Multi-column layout works (if implemented)
  - [ ] Hover states visible and smooth

---

## 5. Firestore Setup & Data Testing

### Collection Setup

- [ ] **Firestore Console**
  - [ ] `staff` collection exists
  - [ ] At least 3-5 sample documents created
  - [ ] Document structure matches schema in `firestore-staff-collection.md`

- [ ] **Sample Data**
  - [ ] Hospital staff with manhã shift
  - [ ] Hospital staff with tarde shift
  - [ ] Hospital staff with plantão 24h shift
  - [ ] Consultório staff with varied schedules
  - [ ] At least one staff member for each day of the week

- [ ] **Document Fields**
  - [ ] `nome` field populated
  - [ ] `tipo` field set to "hospital" or "consultorio"
  - [ ] `dias` object contains valid day keys (segunda, terca, etc.)
  - [ ] Each day has `turno`, `local`, `ativo` fields
  - [ ] `ativo` field set to true
  - [ ] `createdAt` and `updatedAt` timestamps present

### Security Rules

- [ ] **Read Access**
  - [ ] Authenticated users can read staff collection
  - [ ] Unauthenticated users cannot read
  - [ ] Query returns data in development

- [ ] **Write Access**
  - [ ] Admins can create staff documents
  - [ ] Admins can update staff documents
  - [ ] Admins can delete staff documents
  - [ ] Non-admins cannot write

### Data Validation

- [ ] **Required Fields**
  - [ ] Documents missing `nome` handled gracefully
  - [ ] Documents missing `tipo` handled gracefully
  - [ ] Documents missing `dias` handled gracefully

- [ ] **Day Names**
  - [ ] Only valid day names (segunda-domingo) work
  - [ ] Accented day names (terça) are converted or rejected
  - [ ] Invalid day names ignored

---

## 6. Accessibility Testing

- [ ] **Keyboard Navigation**
  - [ ] Tab order logical through staff items
  - [ ] Edit button accessible via keyboard
  - [ ] Focus indicators visible

- [ ] **Screen Reader**
  - [ ] Card title announced correctly
  - [ ] Section labels read properly
  - [ ] Staff names and roles announced
  - [ ] Edit button has descriptive label

- [ ] **Color Contrast**
  - [ ] Text meets WCAG AA standards (4.5:1 for normal text)
  - [ ] Status badges have sufficient contrast
  - [ ] Dark mode maintains contrast

---

## 7. Performance Testing

- [ ] **Initial Load**
  - [ ] Staff data loads within 2 seconds
  - [ ] No layout shift during load
  - [ ] Loading states display smoothly

- [ ] **Re-renders**
  - [ ] Component doesn't re-render unnecessarily
  - [ ] useMemo prevents expensive calculations on each render
  - [ ] No console warnings about performance

- [ ] **Large Datasets**
  - [ ] Test with 50+ staff members
  - [ ] Filtering remains responsive
  - [ ] No UI lag or freezing

---

## 8. Cross-Browser Testing

- [ ] **Chrome/Chromium**
  - [ ] All features work
  - [ ] Dark mode works
  - [ ] No console errors

- [ ] **Firefox**
  - [ ] All features work
  - [ ] Dark mode works
  - [ ] No console errors

- [ ] **Safari**
  - [ ] All features work
  - [ ] Dark mode works
  - [ ] No console errors

- [ ] **Mobile Browsers**
  - [ ] Safari iOS works
  - [ ] Chrome Android works
  - [ ] Responsive layout correct

---

## 9. Error Handling

- [ ] **Network Errors**
  - [ ] Firestore connection failure handled
  - [ ] User-friendly error message displayed
  - [ ] Falls back to mock data or shows retry option

- [ ] **Missing Data**
  - [ ] Empty collection shows appropriate message
  - [ ] Staff with no schedule for current day handled
  - [ ] Invalid schedule data skipped or sanitized

- [ ] **Permission Errors**
  - [ ] Firestore permission denied shows clear message
  - [ ] Edit button hidden if permission check fails

---

## 10. Edge Cases

- [ ] **Unusual Schedules**
  - [ ] Staff working all 7 days displays correctly
  - [ ] Staff working only weekends displays correctly
  - [ ] Staff with 24h shifts on multiple days

- [ ] **Name Variations**
  - [ ] Very long names (30+ characters) truncate
  - [ ] Names with special characters (accents, hyphens)
  - [ ] Single-word names (no space)

- [ ] **Time-Based Logic**
  - [ ] Day detection works across timezones
  - [ ] Midnight boundary handled correctly
  - [ ] Weekend detection accurate

---

## 11. Visual Regression Testing

- [ ] **Screenshot Comparison**
  - [ ] Take screenshots of component in all states
  - [ ] Compare before/after any styling changes
  - [ ] Check for unintended visual changes

- [ ] **Design System Consistency**
  - [ ] Colors match design system palette
  - [ ] Spacing uses design tokens (4px grid)
  - [ ] Typography matches design system

---

## 12. Documentation Verification

- [ ] **Code Comments**
  - [ ] Complex logic has explanatory comments
  - [ ] Props are documented in JSDoc format
  - [ ] File headers include purpose description

- [ ] **README/Docs**
  - [ ] `firestore-staff-collection.md` is accurate
  - [ ] Sample data matches actual implementation
  - [ ] Security rules documented

- [ ] **Type Safety**
  - [ ] PropTypes defined (if using PropTypes)
  - [ ] TypeScript types correct (if using TS)

---

## Testing Sign-Off

**Tester Name:** ___________________________

**Date:** ___________________________

**Version Tested:** ___________________________

**Overall Status:**
- [ ] All tests passed
- [ ] Minor issues found (documented below)
- [ ] Major issues found (requires fixes)

**Notes:**

---

## Automated Testing (Optional)

If implementing automated tests, cover:

- [ ] Unit tests for useStaff hook
- [ ] Integration tests for HomePage staff section
- [ ] Visual regression tests with Chromatic/Percy
- [ ] E2E tests with Cypress/Playwright
- [ ] Accessibility tests with axe-core
