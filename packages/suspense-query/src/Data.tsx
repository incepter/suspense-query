import * as React from "react";
import { FiberProducer, UseDataOptions } from "./types";

type DataProps<T, A extends unknown[], R> = {
	query: FiberProducer<T, A, R>;
	options?: UseDataOptions<T, A, R>;

	Component: (props: {data: T}) => React.ReactNode;
	errorComponent?: (props: {error: R}) => React.ReactNode;
	fallback?: React.ReactNode | ((props: {args: A}) => React.ReactNode);
};

export default function Data<T, A extends unknown[], R>(
	props: DataProps<T, A, R>
) {
	return null;
}
