import { useOutletContext } from "react-router-dom";
import OrganizationView from "@/components/views/OrganizationView";
import type { LayoutContextType } from "@/components/layout/Layout";

export default function Organizacion() {
	const { orgProps } = useOutletContext<LayoutContextType>();
	return <OrganizationView {...orgProps} />;
}
