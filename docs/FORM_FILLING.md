# Form Filling Guide

This guide covers the comprehensive form filling capabilities of Chrome DevTools CLI, including single field filling, batch operations, and advanced usage patterns.

## Overview

Chrome DevTools CLI provides two main commands for form automation:

- **`fill`**: Fill individual form fields
- **`fill_form`**: Fill multiple form fields in batch

Both commands support input, textarea, and select elements with comprehensive error handling and flexible options.

## Single Field Filling (`fill` command)

### Basic Usage

```bash
# Fill a text input
chrome-cdp-cli fill "#username" "john@example.com"

# Fill a password field
chrome-cdp-cli fill "input[type='password']" "secret123"

# Fill a textarea
chrome-cdp-cli fill "#message" "Hello, this is a test message"
```

### Select Elements

The `fill` command intelligently handles select dropdowns:

```bash
# Match by option value
chrome-cdp-cli fill "#country" "US"

# Match by option text
chrome-cdp-cli fill "#country" "United States"

# Works with any select element
chrome-cdp-cli fill "select[name='category']" "Technology"
```

### Advanced Options

```bash
# Don't clear existing content
chrome-cdp-cli fill "#notes" " - Additional note" --no-clear

# Custom timeout for slow-loading elements
chrome-cdp-cli fill ".dynamic-field" "value" --timeout 10000

# Don't wait for element (fail immediately if not found)
chrome-cdp-cli fill "#optional-field" "value" --no-wait
```

### Command Options

| Option | Default | Description |
|--------|---------|-------------|
| `--wait-for-element` | `true` | Wait for element to appear in DOM |
| `--no-wait` | - | Don't wait for element (alias for `--wait-for-element=false`) |
| `--timeout <ms>` | `5000` | Timeout for waiting for element |
| `--clear-first` | `true` | Clear field before filling |
| `--no-clear` | - | Don't clear field (alias for `--clear-first=false`) |

## Batch Form Filling (`fill_form` command)

### Basic Usage

```bash
# Fill multiple fields with JSON
chrome-cdp-cli fill_form --fields '[
  {"selector":"#firstName","value":"John"},
  {"selector":"#lastName","value":"Doe"},
  {"selector":"#email","value":"john.doe@example.com"}
]'
```

### Using JSON Files

```bash
# Create a form data file
cat > registration-form.json << EOF
[
  {"selector":"#username","value":"johndoe"},
  {"selector":"#email","value":"john@example.com"},
  {"selector":"#password","value":"securepassword123"},
  {"selector":"#confirmPassword","value":"securepassword123"},
  {"selector":"#country","value":"United States"},
  {"selector":"#newsletter","value":"true"}
]
EOF

# Fill form from file
chrome-cdp-cli fill_form --fields-file registration-form.json
```

### Error Handling Modes

```bash
# Continue filling other fields if one fails (default)
chrome-cdp-cli fill_form --fields '[
  {"selector":"#field1","value":"value1"},
  {"selector":"#nonexistent","value":"value2"},
  {"selector":"#field3","value":"value3"}
]' --continue-on-error

# Stop on first error
chrome-cdp-cli fill_form --fields '[
  {"selector":"#field1","value":"value1"},
  {"selector":"#nonexistent","value":"value2"}
]' --stop-on-error
```

### Advanced Options

```bash
# Custom timeout and no clearing
chrome-cdp-cli fill_form --fields '[
  {"selector":"#notes","value":"Additional information"}
]' --no-clear --timeout 15000 --stop-on-error
```

### Command Options

| Option | Default | Description |
|--------|---------|-------------|
| `--fields <json>` | - | JSON array of field objects |
| `--fields-file <file>` | - | JSON file containing field array |
| `--wait-for-elements` | `true` | Wait for all elements to appear |
| `--no-wait` | - | Don't wait for elements |
| `--timeout <ms>` | `5000` | Timeout for each field |
| `--clear-first` | `true` | Clear all fields before filling |
| `--no-clear` | - | Don't clear fields |
| `--continue-on-error` | `true` | Continue if a field fails |
| `--stop-on-error` | - | Stop on first field failure |

## Supported Form Elements

### Input Types

All standard HTML input types are supported:

```html
<!-- Text inputs -->
<input type="text" id="username">
<input type="email" id="email">
<input type="password" id="password">
<input type="search" id="search">
<input type="url" id="website">
<input type="tel" id="phone">

<!-- Number inputs -->
<input type="number" id="age">
<input type="range" id="slider">

<!-- Date/time inputs -->
<input type="date" id="birthdate">
<input type="time" id="appointment">
<input type="datetime-local" id="meeting">
```

### Textarea Elements

```html
<textarea id="message" rows="4" cols="50"></textarea>
```

```bash
chrome-cdp-cli fill "#message" "This is a multi-line
message that spans
multiple lines"
```

### Select Elements

```html
<select id="country">
  <option value="US">United States</option>
  <option value="CA">Canada</option>
  <option value="UK">United Kingdom</option>
</select>
```

```bash
# Match by value
chrome-cdp-cli fill "#country" "US"

# Match by text
chrome-cdp-cli fill "#country" "United States"
```

## Real-World Examples

### Login Form

```bash
# Simple login
chrome-cdp-cli fill_form --fields '[
  {"selector":"#username","value":"john@example.com"},
  {"selector":"#password","value":"mypassword123"}
]'

# Then submit (using eval for form submission)
chrome-cdp-cli eval "document.querySelector('#login-form').submit()"
```

### Registration Form

```bash
# Complex registration with validation
chrome-cdp-cli fill_form --fields '[
  {"selector":"#firstName","value":"John"},
  {"selector":"#lastName","value":"Doe"},
  {"selector":"#email","value":"john.doe@example.com"},
  {"selector":"#phone","value":"555-123-4567"},
  {"selector":"#country","value":"United States"},
  {"selector":"#state","value":"California"},
  {"selector":"#city","value":"San Francisco"},
  {"selector":"#zipCode","value":"94105"},
  {"selector":"#newsletter","value":"true"}
]' --timeout 10000
```

### E-commerce Checkout

```bash
# Shipping information
chrome-cdp-cli fill_form --fields '[
  {"selector":"#shipping-name","value":"John Doe"},
  {"selector":"#shipping-address","value":"123 Main St"},
  {"selector":"#shipping-city","value":"San Francisco"},
  {"selector":"#shipping-state","value":"CA"},
  {"selector":"#shipping-zip","value":"94105"}
]'

# Payment information (be careful with sensitive data!)
chrome-cdp-cli fill_form --fields '[
  {"selector":"#card-number","value":"4111111111111111"},
  {"selector":"#card-expiry","value":"12/25"},
  {"selector":"#card-cvv","value":"123"}
]' --timeout 15000
```

### Survey Form

```bash
# Multi-step survey
chrome-cdp-cli fill_form --fields '[
  {"selector":"#age","value":"30"},
  {"selector":"#occupation","value":"Software Engineer"},
  {"selector":"#experience","value":"5-10 years"},
  {"selector":"#satisfaction","value":"Very Satisfied"},
  {"selector":"#comments","value":"Great product! Very easy to use."}
]' --continue-on-error
```

## Error Handling and Debugging

### Common Error Scenarios

```bash
# Element not found
chrome-cdp-cli fill "#nonexistent" "value"
# Error: Element with selector "#nonexistent" not found within 5000ms

# Invalid element type
chrome-cdp-cli fill "#image" "value"
# Error: Element is not a form field (input, textarea, or select)

# Select option not found
chrome-cdp-cli fill "#country" "InvalidCountry"
# Error: Option not found in select element: InvalidCountry
```

### Debugging Tips

```bash
# Use eval to check if element exists
chrome-cdp-cli eval "!!document.querySelector('#username')"

# Check element type
chrome-cdp-cli eval "document.querySelector('#field').tagName"

# Check select options
chrome-cdp-cli eval "Array.from(document.querySelector('#country').options).map(o => ({value: o.value, text: o.textContent}))"

# Check current field value
chrome-cdp-cli eval "document.querySelector('#username').value"
```

### Verbose Output

Use `--verbose` flag for detailed logging:

```bash
chrome-cdp-cli --verbose fill_form --fields '[
  {"selector":"#field1","value":"value1"},
  {"selector":"#field2","value":"value2"}
]'
```

## Integration with Other Commands

### Combining with Element Interaction

```bash
# Fill form and submit
chrome-cdp-cli fill "#username" "john@example.com"
chrome-cdp-cli fill "#password" "secret123"
chrome-cdp-cli click "#submit-button"
```

### Combining with Eval for Complex Logic

```bash
# Fill form with validation
chrome-cdp-cli fill_form --fields '[
  {"selector":"#email","value":"john@example.com"},
  {"selector":"#password","value":"password123"}
]'

# Validate and submit
chrome-cdp-cli eval "
const email = document.querySelector('#email').value;
const password = document.querySelector('#password').value;

if (email.includes('@') && password.length >= 8) {
  document.querySelector('#submit').click();
  return 'Form submitted successfully';
} else {
  return 'Validation failed: ' + (email.includes('@') ? 'Password too short' : 'Invalid email');
}
"
```

### Combining with Screenshots

```bash
# Fill form and capture result
chrome-cdp-cli fill_form --fields-file form-data.json
chrome-cdp-cli screenshot --filename after-form-fill.png
```

## Performance Considerations

### Batch vs Individual Commands

```bash
# Slower: Individual commands
chrome-cdp-cli fill "#field1" "value1"
chrome-cdp-cli fill "#field2" "value2"
chrome-cdp-cli fill "#field3" "value3"

# Faster: Batch command
chrome-cdp-cli fill_form --fields '[
  {"selector":"#field1","value":"value1"},
  {"selector":"#field2","value":"value2"},
  {"selector":"#field3","value":"value3"}
]'
```

### Timeout Optimization

```bash
# Use shorter timeouts for known-fast elements
chrome-cdp-cli fill "#username" "value" --timeout 1000

# Use longer timeouts for dynamic content
chrome-cdp-cli fill ".ajax-loaded-field" "value" --timeout 15000
```

### No-Wait for Optional Fields

```bash
# Don't wait for optional fields
chrome-cdp-cli fill_form --fields '[
  {"selector":"#required-field","value":"value1"},
  {"selector":"#optional-field","value":"value2"}
]' --no-wait
```

## Best Practices

### 1. Use Specific Selectors

```bash
# Good: Specific and unique
chrome-cdp-cli fill "#user-email" "john@example.com"

# Better: Even more specific
chrome-cdp-cli fill "form#login input[name='email']" "john@example.com"

# Avoid: Too generic
chrome-cdp-cli fill "input" "john@example.com"
```

### 2. Handle Dynamic Content

```bash
# Wait for dynamic forms to load
chrome-cdp-cli eval "
new Promise(resolve => {
  const check = () => {
    if (document.querySelector('#dynamic-form')) {
      resolve('Form loaded');
    } else {
      setTimeout(check, 100);
    }
  };
  check();
})
"

# Then fill the form
chrome-cdp-cli fill_form --fields-file form-data.json
```

### 3. Validate Before Submission

```bash
# Fill form
chrome-cdp-cli fill_form --fields-file form-data.json

# Validate all fields are filled
chrome-cdp-cli eval "
const requiredFields = ['#username', '#email', '#password'];
const emptyFields = requiredFields.filter(selector => 
  !document.querySelector(selector).value
);
emptyFields.length === 0 ? 'All fields filled' : 'Empty fields: ' + emptyFields.join(', ')
"
```

### 4. Use JSON Files for Complex Forms

```bash
# Create reusable form data
cat > user-profile.json << EOF
[
  {"selector":"#firstName","value":"John"},
  {"selector":"#lastName","value":"Doe"},
  {"selector":"#email","value":"john.doe@example.com"},
  {"selector":"#phone","value":"555-123-4567"},
  {"selector":"#address","value":"123 Main St"},
  {"selector":"#city","value":"San Francisco"},
  {"selector":"#state","value":"CA"},
  {"selector":"#zipCode","value":"94105"}
]
EOF

# Use across different scenarios
chrome-cdp-cli fill_form --fields-file user-profile.json
```

### 5. Error Recovery Strategies

```bash
# Strategy 1: Continue on error (default)
chrome-cdp-cli fill_form --fields-file form-data.json --continue-on-error

# Strategy 2: Stop on error for critical forms
chrome-cdp-cli fill_form --fields-file payment-form.json --stop-on-error

# Strategy 3: Retry failed fields individually
chrome-cdp-cli fill_form --fields-file form-data.json --continue-on-error
# Check results and retry failed fields manually
chrome-cdp-cli fill "#failed-field" "retry-value" --timeout 15000
```

## Troubleshooting

### Common Issues and Solutions

1. **Element Not Found**
   ```bash
   # Check if element exists
   chrome-cdp-cli eval "!!document.querySelector('#field')"
   
   # Wait for element to appear
   chrome-cdp-cli fill "#field" "value" --timeout 10000
   ```

2. **Select Option Not Found**
   ```bash
   # Check available options
   chrome-cdp-cli eval "Array.from(document.querySelector('#select').options).map(o => o.value + ' - ' + o.textContent)"
   ```

3. **Form Validation Errors**
   ```bash
   # Check validation state
   chrome-cdp-cli eval "document.querySelector('#field').checkValidity()"
   
   # Get validation message
   chrome-cdp-cli eval "document.querySelector('#field').validationMessage"
   ```

4. **Timing Issues**
   ```bash
   # Wait for page to be ready
   chrome-cdp-cli eval "document.readyState"
   
   # Wait for specific condition
   chrome-cdp-cli eval "
   new Promise(resolve => {
     const check = () => {
       if (document.querySelector('#form').style.display !== 'none') {
         resolve('Form visible');
       } else {
         setTimeout(check, 100);
       }
     };
     check();
   })
   "
   ```

## Advanced Usage Patterns

### Conditional Form Filling

```bash
# Fill form based on page state
chrome-cdp-cli eval "
const isLoggedIn = !!document.querySelector('#user-menu');
if (!isLoggedIn) {
  // Fill login form
  document.querySelector('#username').value = 'john@example.com';
  document.querySelector('#password').value = 'password123';
  document.querySelector('#login-form').submit();
} else {
  // Already logged in
  return 'User already logged in';
}
"
```

### Multi-Step Forms

```bash
# Step 1: Personal information
chrome-cdp-cli fill_form --fields '[
  {"selector":"#firstName","value":"John"},
  {"selector":"#lastName","value":"Doe"}
]'
chrome-cdp-cli click "#next-step"

# Wait for next step to load
chrome-cdp-cli eval "
new Promise(resolve => {
  const check = () => {
    if (document.querySelector('#step2')) {
      resolve('Step 2 loaded');
    } else {
      setTimeout(check, 100);
    }
  };
  check();
})
"

# Step 2: Contact information
chrome-cdp-cli fill_form --fields '[
  {"selector":"#email","value":"john@example.com"},
  {"selector":"#phone","value":"555-123-4567"}
]'
chrome-cdp-cli click "#submit"
```

### Form Automation with Screenshots

```bash
# Take before screenshot
chrome-cdp-cli screenshot --filename before-form.png

# Fill form
chrome-cdp-cli fill_form --fields-file form-data.json

# Take after screenshot
chrome-cdp-cli screenshot --filename after-form.png

# Submit and capture result
chrome-cdp-cli click "#submit"
chrome-cdp-cli screenshot --filename form-submitted.png
```

This comprehensive guide covers all aspects of form filling with Chrome DevTools CLI. For more examples and advanced usage patterns, see the main README and other documentation files.