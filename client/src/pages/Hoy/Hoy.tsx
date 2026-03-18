import { useOutletContext } from "react-router-dom";
import TodayKanban from "@/components/views/TodayView";
import type { LayoutContextType } from "@/components/layout/Layout";

export default function Hoy() {
	const { todayProps } = useOutletContext<LayoutContextType>();
	return <TodayKanban {...todayProps} />;
}
