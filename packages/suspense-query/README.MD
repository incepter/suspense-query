# React Suspense Query

A library for React Suspense Query management

## `useQueryData`

```tsx
let { userId } = useParams();

// useQueryControls<TData, TArgs extends unknown[], TError>(name: string, options?);
// infered user type from fn: User
let user = useQueryData("user-details", {
	fn: getUserDetails,
	args: [+userId],
});
```

## `useQueryError`

```tsx
// useQueryError<TError>(name: string)
let error = useQueryError("user-details");
```

## `useQueryControls`

```tsx
// needs types annotation
// useQueryControls<TData, TArgs extends unknown[], TError>(name: string)
let { isPending, run, setData, setError } = useQueryControls("user-details");
```

## Roadmap

- [x] Basic Query sharing and manipulation
- [ ] Cache management
- [ ] Mutations
- [ ] SSR
- [ ] RSC
