# Refactoring Plan: Simplifying useInterview Hook

## Current Features (Must Preserve)

### Core Interview Flow
1. **Question Progression**: Multiple primary questions, move through them sequentially
2. **Follow-up Questions**: Claude can ask up to 2 follow-up questions per primary question
3. **Question Completion**: Auto-advance to next question when:
   - Claude says "QUESTION_COMPLETE"
   - 2 follow-ups have been asked
   - User has typed 400+ characters for current question
4. **Skip Question**: User can manually skip questions
5. **Interview Completion**: Generate article when all questions are done
6. **Manual Summary**: User can type "GENERATE_SUMMARY" to end early

### User Experience Features
7. **Optimistic UI**: User messages appear immediately in the UI (no waiting for API)
8. **5-Second Debounce**: Wait 5 seconds after user stops typing before calling Claude API
9. **Immediate Mode**: Can bypass debounce (though not currently used in UI)
10. **Character Tracking**: Track total characters user has typed per question
11. **Loading States**: Show loading indicators during API calls

### Data Features
12. **Email Sending**: Send summary/error emails
13. **Article Generation**: Generate newsletter article from conversation
14. **Question Data Helpers**: `getCurrentQuestionData()` and `getAllQuestionsData()` functions

## Current Complexity Issues

### 1. Multiple Sources of Truth for Messages
- `messages` (state) - the actual messages array
- `messagesRef.current` (ref) - synced copy via useEffect
- `pendingMessages` (state) - messages waiting for debounce

**Problem**: Creates sync issues, confusion about which to use, and bugs like missing assistant messages.

### 2. Complex Debouncing Logic
- Manual timer management with `debounceTimer` state
- Separate `pendingMessages` tracking
- Reconstructing message arrays from refs
- Complex logic in useEffect

**Problem**: Error-prone, hard to reason about, causes timing bugs.

### 3. Redundant State Tracking
- `questionStartMessageIndex` (state) - tracks where question starts
- `findCurrentQuestionStart()` (function) - searches backwards to find it
- Both maintained separately, causing inconsistencies

**Problem**: Two sources of truth, complex search logic, potential mismatches.

### 4. Repeated Calculations
- `assistantMessagesForCurrentQuestion` calculated in multiple places (lines 328, 478)
- `findCurrentQuestionStart` called multiple times per process
- Follow-up count calculated on-the-fly instead of maintained

**Problem**: Performance issues, code duplication, potential inconsistencies.

### 5. Excessive Logging
- Many console.log statements throughout
- Makes code harder to read and maintain

## Simplification Strategy (No Feature Loss)

### 1. Single Source of Truth
- **Keep**: `messages` state as the ONLY source of truth
- **Remove**: `messagesRef` (not needed if we use state properly)
- **Remove**: `pendingMessages` (can derive from messages or use simpler debounce)

### 2. Simplified Debouncing
- Use a custom `useDebounce` hook or simpler debounce logic
- Debounce the API call, not the message storage
- Messages still appear immediately (optimistic UI preserved)

### 3. Memoized Derived State
- Use `useMemo` for:
  - `questionStartIndex` - calculate once from messages
  - `assistantMessagesForCurrentQuestion` - filter once
  - `currentFollowUpCount` - calculate from assistant messages
  - `messagesSinceQuestionStart` - slice once

### 4. Simplified Question Tracking
- Remove `questionStartMessageIndex` state
- Calculate question boundaries from `messages` array using `useMemo`
- Store question boundaries as metadata in messages or calculate on-demand

### 5. Cleaner Code
- Remove excessive console.logs (keep only critical ones)
- Extract helper functions for clarity
- Better separation of concerns

## Refactoring Prompt

```
Refactor the useInterview hook to simplify state management while preserving ALL current features.

Key Requirements:
1. Single Source of Truth: Use only `messages` state array. Remove `messagesRef` and `pendingMessages`.

2. Simplified Debouncing:
   - Keep the 5-second debounce behavior (wait 5 seconds after user stops typing)
   - Keep optimistic UI (user messages appear immediately)
   - Use a simpler debounce approach - debounce the API call, not message storage
   - Preserve the `immediate` parameter for submitAnswer (bypass debounce)

3. Memoized Derived State:
   - Use `useMemo` to calculate:
     * `questionStartIndex` - find where current question starts in messages array
     * `messagesSinceQuestionStart` - slice of messages from question start
     * `assistantMessagesForCurrentQuestion` - filter assistant messages for current question
     * `currentFollowUpCount` - count of follow-ups (assistant messages - 1)
   - Remove `questionStartMessageIndex` state (calculate instead)
   - Remove redundant `findCurrentQuestionStart` function or simplify it

4. Preserve All Features:
   - Question progression (multiple primary questions)
   - Follow-up limit (max 2 per question)
   - Question completion triggers (QUESTION_COMPLETE, 2 follow-ups, 400 chars)
   - Skip question functionality
   - Interview completion and article generation
   - Manual summary trigger ("GENERATE_SUMMARY")
   - Character tracking per question
   - Email sending
   - All helper functions (getCurrentQuestionData, getAllQuestionsData)
   - Loading states
   - All return values from the hook

5. Code Quality:
   - Remove excessive console.log statements (keep only critical debugging)
   - Extract complex logic into well-named helper functions
   - Add clear comments for complex business logic
   - Maintain the same function signatures for public API

6. Performance:
   - Avoid recalculating derived values unnecessarily
   - Use proper dependency arrays in useMemo/useEffect
   - Ensure no unnecessary re-renders

The refactored code should be:
- Easier to understand and maintain
- Less prone to bugs
- Same functionality and user experience
- Better performance through memoization
```

## Expected Benefits

1. **Easier Debugging**: Single source of truth means no sync issues
2. **Fewer Bugs**: No more missing assistant messages or state mismatches
3. **Better Performance**: Memoized calculations instead of repeated work
4. **Cleaner Code**: Less complexity, easier to reason about
5. **Easier Testing**: Simpler state makes testing straightforward
6. **Easier Maintenance**: Future changes will be simpler

## Migration Notes

- The public API (return values) should remain the same
- UI components using the hook should not need changes
- All features should work exactly as before
- Performance should be equal or better

