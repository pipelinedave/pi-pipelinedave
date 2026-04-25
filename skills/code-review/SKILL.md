---
name: code-review
description: Perform comprehensive code reviews identifying bugs, security issues, performance problems, and style inconsistencies. Use before committing code or merging PRs.
---

# Code Review Skill

Automated code review focusing on correctness, security, performance, and maintainability.

## Review Checklist

### ✅ Correctness
- Logic errors and edge cases
- Null/undefined handling
- Error handling completeness
- Type safety
- Race conditions

### 🔒 Security
- Input validation
- SQL injection risks
- XSS vulnerabilities
- Authentication/authorization
- Sensitive data exposure
- Dependency vulnerabilities

### ⚡ Performance
- Inefficient loops
- Unnecessary computations
- Memory leaks
- Database N+1 queries
- Caching opportunities

### 🎨 Style & Maintainability
- Code consistency
- Naming conventions
- Function complexity
- Documentation gaps
- DRY violations
- Test coverage

## Usage

### Review Uncommitted Changes
```bash
# Review all staged changes
git diff --cached | review-code

# Review working directory
git diff | review-code
```

### Review Specific Files
```bash
review-code src/components/Button.tsx src/hooks/useAuth.ts
```

### Review PR/Commit
```bash
# Review last commit
git show HEAD | review-code

# Review PR diff (from GitHub CLI)
gh pr diff 123 | review-code
```

## Review Output Format

```markdown
## Code Review Summary

**Files Changed**: 3
**Lines Added**: 45
**Lines Removed**: 12

### 🚨 Critical Issues (2)
1. **Security**: SQL injection in `user.ts:45`
   - Problem: Direct string interpolation
   - Fix: Use parameterized queries

2. **Bug**: Null pointer in `api.ts:123`
   - Problem: Missing null check
   - Fix: Add optional chaining

### ⚠️ Warnings (3)
1. **Performance**: O(n²) loop in `utils.ts:67`
2. **Style**: Function too long (85 lines) in `handler.ts`
3. **Test**: No tests for new feature

### 💡 Suggestions (5)
1. Extract magic number to constant
2. Add JSDoc comments
3. Consider using Map instead of Object
...
```

## Quick Review Commands

### Minimal Review
```bash
review-code --quick file.ts
```
Focuses on critical issues only.

### Deep Review
```bash
review-code --deep --security --performance file.ts
```
Comprehensive analysis including security and performance.

### Style Only
```bash
review-code --style file.ts
```
Focuses on code style and conventions.

## Integration with Pi

When using with pi:

1. **Before commit**: "Review my changes before I commit"
2. **PR preparation**: "Review this PR for security issues"
3. **Learning**: "Explain the issues found in this code"
4. **Fix suggestions**: "Fix all critical issues found"

## Language-Specific Checks

### TypeScript/JavaScript
- Type safety
- Async/await errors
- Promise handling
- Event listener leaks
- Closure issues

### Python
- Type hints
- Context managers
- Generator usage
- GIL considerations
- Decorator correctness

### Go
- Error handling
- Goroutine leaks
- Context propagation
- Interface design
- Benchmark opportunities

### Rust
- Ownership issues
- Borrow checker patterns
- Unsafe blocks
- Lifetime annotations
- FFI safety

## Best Practices

1. **Review early**: Catch issues before they compound
2. **Be specific**: Point to exact lines and provide fixes
3. **Prioritize**: Critical > Warning > Suggestion
4. **Contextual**: Consider the bigger picture
5. **Educational**: Explain why something is an issue

## Common Patterns to Catch

### Anti-patterns
```typescript
// ❌ No error handling
fetch('/api/data').then(r => r.json());

// ✅ Proper handling
try {
  const response = await fetch('/api/data');
  if (!response.ok) throw new Error('HTTP error');
  const data = await response.json();
} catch (error) {
  console.error('Failed to fetch:', error);
  throw error;
}
```

### Security
```typescript
// ❌ SQL Injection risk
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Safe
const query = 'SELECT * FROM users WHERE id = $1';
const result = await pool.query(query, [userId]);
```

### Performance
```typescript
// ❌ O(n²) complexity
for (let i = 0; i < items.length; i++) {
  for (let j = 0; j < items.length; j++) {
    // ...
  }
}

// ✅ O(n) with Map
const map = new Map(items.map(item => [item.id, item]));
items.forEach(item => {
  const related = map.get(relatedId);
  // ...
});
```

## Automated Fixes

Some issues can be auto-fixed:

```bash
review-code --auto-fix file.ts
```

Auto-fixable issues:
- Formatting inconsistencies
- Unused imports
- Missing semicolons
- Trailing whitespace
- Simple refactors

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/review.yml
- name: Code Review
  run: |
    npm run review
    # Fail if critical issues found
    npm run review -- --fail-on=critical
```

---

**Auto-detected**: Code review capability
**Best for**: Pre-commit checks, PR reviews, code quality
**Output**: Detailed markdown report with fixes
