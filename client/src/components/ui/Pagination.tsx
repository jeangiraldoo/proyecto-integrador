import { ChevronLeft, ChevronsLeft, ChevronRight, ChevronsRight } from "lucide-react";
import "./Pagination.css";
 
interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}
 
export default function Pagination({
	currentPage,
	totalPages,
	onPageChange,
}: PaginationProps) {
	const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
 
	const startPage = Math.max(1, currentPage - 2);
	const endPage = Math.min(totalPages, currentPage + 2);
 
	const pagesToDisplay = pages.slice(startPage - 1, endPage + 1);
 
	const hasPreviousPage = currentPage > 1;
	const hasNextPage = currentPage < totalPages;
 
	if (totalPages <= 1) {
		return null;
	}
 
	return (
		<div className="pagination-container">
			<button
				onClick={() => onPageChange(1)}
				disabled={currentPage <= 1}
				className="pagination-button"
			>
				<ChevronsLeft className="w-4 h-4" />
			</button>
 
			<button
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage <= 1}
				className="pagination-button"
			>
				<ChevronLeft className="w-4 h-4" />
			</button>
 
			<div className="pagination-pages">
				{pagesToDisplay.map((page, i) =>
					typeof page === "number" ? (
						<button
							key={i}
							onClick={() => onPageChange(page)}
							className={`pagination-page-button ${
								page === currentPage ? "active" : ""
							}`}
						>
							{page}
						</button>
					) : (
						<span key={i} className="pagination-ellipsis">
							{page}
						</span>
					),
				)}
			</div>
 
			<button
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage >= totalPages}
				className="pagination-button"
			>
				<ChevronRight className="w-4 h-4" />
			</button>
 
			<button
				onClick={() => onPageChange(totalPages)}
				disabled={currentPage >= totalPages}
				className="pagination-button"
			>
				<ChevronsRight className="w-4 h-4" />
			</button>
		</div>
	);
}