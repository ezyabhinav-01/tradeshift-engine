# Usability & UX Metrics Strategy

This document outlines the testing strategy for UX metrics tracking using PostHog and Mixpanel in the Tradeshift Engine.

## 1. Core Event Tracking Requirements
For end-to-end usability testing to be effective, the following core events must be instrumented and validated:

| Event Name | Trigger | Properties |
| --- | --- | --- |
| `user_signed_up` | Successful registration | `method` (email/google) |
| `user_logged_in` | Successful login | `session_id` |
| `trade_executed` | Submission of `/api/trade` | `symbol`, `quantity`, `order_type`, `direction` |
| `portfolio_viewed` | Navigating to Portfolio Page | `total_value` |
| `error_encountered` | UI Error Boundary catch | `error_message`, `component_stack` |

## 2. E2E Validation of Analytics
When writing Playwright tests, we can intercept network requests to PostHog/Mixpanel to ensure events are fired correctly during user flows.

**Example Playwright Intercept:**
```typescript
test('Validates trade execution event fires', async ({ page }) => {
  // Listen for Mixpanel/PostHog tracking requests
  const eventPromise = page.waitForRequest(request => 
    request.url().includes('api.mixpanel.com/track') && 
    request.postDataJSON()?.event === 'trade_executed'
  );

  // Perform trade action in UI
  await page.getByRole('button', { name: 'Buy RELIANCE' }).click();
  
  // Await the tracking event
  const request = await eventPromise;
  expect(request).toBeTruthy();
});
```

## 3. Feedback Loop & Dashboards
Usability testing shouldn't just be automated checks. The product team should review the following funnels weekly:
- **Registration Drop-off Funnel**: Tracks the drop-off rate between `/register` -> OTP Verification -> PIN Setup.
- **Order Execution Speed**: Tracks the average time elapsed between a user clicking a stock symbol and confirming the execution modal.
