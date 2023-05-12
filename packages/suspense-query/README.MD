# React Suspense Query

A library for React Suspense Query management

# Usage

Assume you have a function `getUserDetails` that gets the user details:

## `useQueryData`

```tsx
let { userId } = useParams();

// useQueryControls<TData, TArgs extends unknown[], TError>(query, options?);
// infered user type from fn: User
let user = useQueryData(getUserDetails, {
	args: [+userId],
});
```

## `useQueryError`

```tsx
// useQueryError<TError>(query)
let error = useQueryError(getUserDetails);
```

## `useQueryControls`

```tsx
// needs types annotation
// useQueryControls<TData, TArgs extends unknown[], TError>(query)
let { isPending, run, setData, setError } = useQueryControls(getUserDetails);
```

## Roadmap

- [x] Basic Query sharing and manipulation
- [ ] Cache management
- [ ] Mutations
- [ ] SSR
- [ ] RSC
