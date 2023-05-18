import React, { useTransition } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { useQueryData } from "suspense-query";
import { API } from "./app/api";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);

export const userIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function App() {
	const [userId, setUserId] = React.useState(1);

	return (
		<div>
			<section>
				<summary>
					<h3>Click to see user details</h3>
					<h5>Button will be disabled when pending</h5>
				</summary>
				<Buttons setId={setUserId} />
			</section>
			<hr />
			<section>
				<summary>
					<h4>Click to Remove user details from cache</h4>
					<h5>Button will be disabled it is the current displayed user</h5>
				</summary>
			</section>
			<hr />

			<UserDetails userId={userId} />
		</div>
	);
}

function UserDetails({ userId }) {
	const user = useQueryData(getUsersDetails, { args: [userId] });
	return (
		<details open>
			<summary>User {user.username} details</summary>
			<pre>{JSON.stringify(user, null, 4)}</pre>
		</details>
	);
}

let Buttons: React.FC<{ setId }> = React.memo(({ setId }) => {
	return (
		<div>
			{userIds.map((u) => (
				<SetUserButton key={u} id={u} setUserId={setId} />
			))}
		</div>
	);
});

export function SetUserButton({ id, setUserId }) {
	const [isPending, start] = useTransition();
	return (
		<button
			disabled={isPending}
			onClick={() => {
				start(() => setUserId(id));
			}}
			className={isPending ? "pending" : ""}
		>
			{id}
		</button>
	);
}

async function getUsersDetails(id: number): Promise<User> {
	let promise = await API.get(`/users/${id}`);
	await new Promise((res) => setTimeout(res, 1000));
	return promise.data;
}
export function InvalidateButton({ id, api }: { id: number; api: any }) {
	const [isPending, start] = useTransition();
	return (
		<button
			disabled={isPending}
			onClick={() => {
				start(() => {
					api.evict(id);
				});
			}}
			className={isPending ? "pending" : ""}
		>
			{id}
		</button>
	);
}
export type Page<T> = {
	page: number;
	size: number;
	content: T[];
	totalPages: number;
};

export type User = {
	id: number;
	email: string;
	username: string;
};
export type Post = {
	id: number;
	title: string;
	userId: number;
};
