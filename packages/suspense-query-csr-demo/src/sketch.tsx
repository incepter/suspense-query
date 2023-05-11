import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import DefaultErrorBoundary from "./app/error-boundary";
import { useQueryControl, useQueryData } from "suspense-query";
import { API } from "./app/api";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<DefaultErrorBoundary>
			<React.Suspense fallback="LoadingApp">
				{/*<br />*/}
				<SearchDisplayDemo />
				<SearchDemo />

				<UserId />
				<CounterDemo />
				<hr />
				{/*<React.Suspense fallback=".....">*/}
				{/*<UsersListDemo />*/}
				{/*<hr />*/}
				<UserDetailsDemo />
				{/*</React.Suspense>*/}
				<hr />
				{/*<React.Suspense fallback=".....">*/}
				{/*</React.Suspense>*/}
				<PendingBar stateName="search" />
			</React.Suspense>
			<hr />
			<PendingBar stateName="search" />
			<hr />
			<PendingBar stateName="counter" />
			<hr />
			<PendingBar stateName="userId" />
			<hr />
			<PendingBar stateName="user-details" />
		</DefaultErrorBoundary>
	</React.StrictMode>
);

function CounterDemo() {
	let count = useQueryData("counter", { initialValue: 0 });
	let { setData } = useQueryControl("counter");

	return (
		<div>
			<button onClick={() => setData(count + 1)}>Count: {count}</button>
		</div>
	);
}

function UserId() {
	let userId = useQueryData("userId", { initialValue: "1" });
	let [value, setValue] = React.useState(userId);
	let { run: search } = useQueryControl("user-details");
	return (
		<div>
			<input value={value} onChange={(e) => setValue(e.target.value)} />
			<button
				onClick={() => {
					search(value);
				}}
			>
				search
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
	let users = useQueryData("users", { fn: getUsers });

	return (
		<div>
			<details>
				<summary>Users {users.length}</summary>
				<pre>{JSON.stringify(users, null, 4)}</pre>
			</details>
		</div>
	);
}

function UserDetailsDemo() {
	let userId = useQueryData<number, never, never>("userId");
	console.log("____UseData1Demo_____start");
	let userData = useQueryData("user-details", {
		fn: getUserDetails,
		initialArgs: [userId],
	});
	console.log("____UseData1Demo_____end");

	return (
		<div>
			<details>
				<summary>
					User {userData.id} - {userData.username}
				</summary>
				<pre>{JSON.stringify(userData, null, 4)}</pre>
			</details>
		</div>
	);
}

function delayedIdentity(id: string) {
	return new Promise<string>((resolve) => {
		setTimeout(() => {
			resolve(id);
		}, 1000 / id.length);
	});
}

function SearchDemo() {
	const { isPending, run } = useQueryControl("search");
	console.log("SuspendingTree ---", isPending);
	return (
		<div>
			<span>{Date.now()}</span>
			<input onChange={(e) => run(e.target.value)} />
		</div>
	);
}

function SearchDisplayDemo() {
	let rerender = React.useState(0)[1];
	const searchResult = useQueryData("search", {
		initialArgs: ["14"],
		fn: delayedIdentity,
	});
	return (
		<div>
			<button onClick={() => rerender((prev) => prev + 1)}>Rerender</button>
			<details open>
				<summary>{Date.now()}</summary>
				<pre>{JSON.stringify({ searchResult }, null, 4)}</pre>
			</details>
		</div>
	);
}

function PendingBar({ stateName }: { stateName: string }) {
	let { isPending } = useQueryControl(stateName);

	return (
		<div>
			<span>
				{stateName} is {isPending ? " ____Pending____" : " Not pending"}
			</span>
		</div>
	);
}
