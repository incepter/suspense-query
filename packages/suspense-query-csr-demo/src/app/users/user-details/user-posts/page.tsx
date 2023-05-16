import * as React from "react";
import { useParams } from "react-router-dom";
import { API } from "../../../api";
import { useQueryData } from "suspense-query";
import { UserType } from "../../types";
import { getUserDetails } from "../page";

async function getUserPosts(userId: number) {
	let result = await API.get(`/users/${userId}/posts`);
	return result.data;
}

export function Component() {
	let { userId } = useParams();

	let userPosts = useQueryData(getUserPosts, {
		args: [+userId!],
	});
	let currentUser = useQueryData<UserType, [number], never>(getUserDetails);

	return (
		<details open>
			<summary>User {currentUser.username} posts</summary>
			<pre>{JSON.stringify(userPosts, null, 4)}</pre>
		</details>
	);
}
