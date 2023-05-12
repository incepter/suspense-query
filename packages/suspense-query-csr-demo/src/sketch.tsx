import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import DefaultErrorBoundary from "./app/error-boundary";
import { useQueryControls, useQueryData } from "suspense-query";
import { API } from "./app/api";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<Wrapper>
			<DefaultErrorBoundary>
				<React.Suspense fallback="LoadingApp">
					{/*<br />*/}

					{/*<CounterDemo />*/}
					{/*<UserId />*/}
					{/*<hr />*/}
					{/*<React.Suspense fallback=".....">*/}
					{/*	<UserDetailsDemo />*/}
					{/*</React.Suspense>*/}
					<React.Suspense fallback=".....">
						<SearchDisplayDemoParent />
					</React.Suspense>
					<SearchDemo />
					<hr />
					{/*<PendingBar query="search" />*/}
				</React.Suspense>
				<hr />
				<PendingBar query={delayedIdentity} />
				{/*<hr />*/}
				<PendingBar query={counter} />
				{/*<hr />*/}
				{/*<PendingBar query="userId" />*/}
				{/*<hr />*/}
				<PendingBar query={getUserDetails} />
			</DefaultErrorBoundary>
		</Wrapper>
	</React.StrictMode>
);

function Wrapper({ init = true, children }) {
	let [visible, setVisible] = React.useState(init);

	return (
		<div>
			<button onClick={() => setVisible(!visible)}>
				{visible ? "Hide" : "Show"}
			</button>
			<hr />
			{visible ? children : null}
		</div>
	);
}

function counter(arg = 0) {
	return arg + 1
}

function CounterDemo() {
	let count = useQueryData(counter, { initialValue: 0 });
	let { setData } = useQueryControls(counter);

	return (
		<div>
			<button onClick={() => setData(count + 1)}>Count: {count}</button>
		</div>
	);
}

function UserId() {
	let [value, setValue] = React.useState("1");
	let { run: search, isPending } = useQueryControls(getUserDetails);
	return (
		<div>
			<input value={value} onChange={(e) => setValue(e.target.value)} />
			<button
				onClick={() => {
					search(+value);
				}}
			>
				search {isPending ? " ..." : ""}
			</button>
		</div>
	);
}

type User = {};

async function getUsers(): Promise<User[]> {
	return (await API.get(`users`)).data;
}

async function getUserDetails(id: number) {
	await new Promise((res) => {
		setTimeout(res, 2000);
	});
	return (await API.get(`users/${id}`)).data;
}

function UsersListDemo() {
	let users = useQueryData(getUsers);

	return (
		<div>
			<details>
				<summary>Users {users.length}</summary>
				<pre>{JSON.stringify(users, null, 4)}</pre>
			</details>
		</div>
	);
}

function delayedIdentity(id: string) {
	return new Promise<string>((resolve) => {
		setTimeout(() => {
			resolve(id);
		}, 3000 / id.length);
	});
}

function SearchDemo() {
	// console.log("query controls start ---");
	const { isPending, run } = useQueryControls(delayedIdentity);
	// console.log("query controls End ---");
	return (
		<div>
			<span>
				{Date.now()} {String(isPending)}
			</span>
			<input onChange={(e) => run(e.target.value)} />
		</div>
	);
}

function SearchDisplayDemo() {
	// console.log("data start");
	const searchResult = useQueryData(delayedIdentity, {
		initialArgs: ["14"],
	});
	// console.log("data end");
	return (
		<div>
			<details open>
				<summary>{Date.now()}</summary>
				<pre>{JSON.stringify({ searchResult }, null, 4)}</pre>
			</details>
		</div>
	);
}

function SearchDisplayDemoParent() {
	let [cn, rerender] = React.useState(0);
	return (
		<div>
			<button
				onClick={() => {
					// console.log("click");
					rerender((prev) => prev + 1);
				}}
			>
				Rerender
			</button>
			<div>
				<SearchDisplayDemo />
			</div>
		</div>
	);
}

function PendingBar({ query }: { query: (...args: any[]) => any }) {
	let { isPending } = useQueryControls(query);

	return (
		<div>
			<span>
				{query.name} is {isPending ? " ____Pending____" : " Not pending"}
			</span>
		</div>
	);
}
