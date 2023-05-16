import { Link, Outlet, useParams } from "react-router-dom";
import { API } from "../../api";
import * as React from "react";
import { useQueryData } from "suspense-query";
import Controls from "../../controls";
import { UserType } from "../types";

export async function getUserDetails(id: number) {
	let promise = await API.get(`/users/${id}`);
	return promise.data;
}

export function Component() {
	let { userId } = useParams();

	let user = useQueryData(getUserDetails, {
		args: [+userId!],
	});

	return (
		<Controls>
			<div style={{ display: "flex", flexDirection: "column" }}>
				<div>
					<details open>
						<summary>User {user.username} details</summary>
						<pre>{JSON.stringify(user, null, 4)}</pre>
					</details>
					<Link to={`posts`}>see posts</Link>
				</div>
				<React.Suspense fallback={`Loading ${user.name}'s posts`}>
					<Outlet />
				</React.Suspense>
			</div>
		</Controls>
	);
}
