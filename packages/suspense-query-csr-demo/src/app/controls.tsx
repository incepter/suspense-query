import {useParams} from "react-router-dom";
import * as React from "react";
import {useQueryControls} from "suspense-query";
import { getUserDetails } from "./users/user-details/page";
import { getUsersList } from "./users/page";

export default function Controls({children}) {
  let params = useParams()

  let usersApi = useQueryControls(getUserDetails);
  let userDetailsApi = useQueryControls(getUsersList);

  return (
    <div>
      {
        params?.userId && (
          <button onClick={() => {
            // @ts-ignore
            usersApi.evict(+params.userId!);
          }}>
            Invalidate user with id {params.userId}'s Cache
          </button>
        )
      }
      <button onClick={() => {
        // @ts-ignore
        userDetailsApi.evict();
      }}>
        Invalidate users list cache
      </button>
      <hr/>
      <div>{children}</div>
    </div>
  )
}
