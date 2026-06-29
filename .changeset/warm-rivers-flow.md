---
'@requence/socketql': minor
---

Add React-aware `createClient` that wraps live query push updates in `startTransition`. This prevents live query pushes from triggering Suspense fallbacks while a `useTransition` is pending. The base `createClient` gains a `wrapLiveQueryUpdate` option for custom wrapping.
