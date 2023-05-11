import {useParams} from "react-router-dom";
import * as React from "react";
import {useQueryControl} from "suspense-query";

export default function Controls({children}) {
  let params = useParams()

  let usersApi = useQueryControl("getUserDetails");
  let userDetailsApi = useQueryControl("getUsersList");

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
