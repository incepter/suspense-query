import * as React from "react";
import { FiberProducer, StateFiber, UseDataOptions } from "./types";
import { useStateFiberCache } from "./StateFiberProvider";
import { getOrCreateStateFiber } from "./StateFiber";
import { useQueryData } from "./StateFiberHooks";

type DataProps<T, A extends unknown[], R> = {
	query: FiberProducer<T, A, R>;
	options?: UseDataOptions<T, A, R>;

	children?: (props: { data: T }) => React.ReactNode;
	Component?: (props: { data: T }) => React.ReactNode;
	errorComponent?: (props: { error: R }) => React.ReactNode;
	fallback?: React.ReactNode | ((props: { args: A }) => React.ReactNode);
};

export default function Data<T, A extends unknown[], R>(
	{
		Component: ComponentProp,
		children,
		errorComponent,
		fallback,
		options,
		query
	}: DataProps<T, A, R>
): React.ReactNode {
	let cache = useStateFiberCache();
	let fiber = getOrCreateStateFiber(cache, query, options);

	let Component = children || ComponentProp;
	if (!Component) {
		throw new Error("At least children or Component is required as a prop.");
	}

	return (
		<ErrorBoundary Component={errorComponent}>
			<React.Suspense
				fallback={<SuspenseFallback fallback={fallback} fiber={fiber} />}
			>
				<DataImpl
					query={query}
					Component={Component}
					options={options}
				/>
			</React.Suspense>
		</ErrorBoundary>
	);
}

function SuspenseFallback<T, A extends unknown[], R>(props: {
	fiber: StateFiber<T, A, R>;
	fallback?: React.ReactNode | ((props: { args: A }) => React.ReactNode);
}) {
	let Fallback = props.fallback;
	if (!Fallback) {
		return null;
	}

	if (typeof Fallback !== "function") {
		return Fallback;
	}

	let args = props.fiber.args as A;
	return <Fallback args={args} />;
}

function DataImpl<T, A extends unknown[], R>(props: {
	query: FiberProducer<T, A, R>;
	options?: UseDataOptions<T, A, R>;
	Component: DataProps<T, A, R>["Component"];
}) {
	const data = useQueryData(props.query, props.options);
	return <props.Component data={data} />;
}

class ErrorBoundary extends React.PureComponent<
	{
		children: React.ReactNode;
		Component?: (props: { error: any }) => React.ReactNode;
	},
	{ error: Error | null }
> {
	constructor(props) {
		super(props);
		this.state = { error: null };
	}
	static getDerivedStateFromError(error, errorInfo) {
		return { error };
	}
	render() {
		const error = this.state.error;
		if (error) {
			const Component = this.props.Component;
			if (!Component) {
				throw error;
			}
			return <Component error={error} />;
		}
		return this.props.children;
	}
}
