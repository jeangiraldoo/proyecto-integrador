// src/components/Subtasks/SubtaskForm.tsx
import React, { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { SubtaskFormData } from "./types";
import "./Subtasks.css";

interface SubtaskFormProps {
	onClose: () => void;
	onSubmit: (data: SubtaskFormData) => Promise<void>;
	isLoading: boolean;
}

export default function SubtaskForm({ onClose, onSubmit, isLoading }: SubtaskFormProps) {
	const [formData, setFormData] = useState<SubtaskFormData>({
		name: "",
		estimated_hours: 0,
		target_date: "",
	});
	const [errors, setErrors] = useState<Partial<Record<keyof SubtaskFormData, string>>>({});

	// Client-side validation based on US-02 acceptance criteria
	const validate = (): boolean => {
		const newErrors: Partial<Record<keyof SubtaskFormData, string>> = {};

		if (!formData.name.trim()) {
			newErrors.name = "The subtask name is required.";
		}
		if (formData.estimated_hours <= 0) {
			newErrors.estimated_hours = "Estimated hours must be greater than 0.";
		}
		if (!formData.target_date) {
			newErrors.target_date = "Target date is required.";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		await onSubmit(formData);
	};

	return (
		<div className="modal-overlay">
			<div className="modal-content glass-card-modal">
				<button onClick={onClose} className="modal-close-btn" disabled={isLoading}>
					<X size={20} />
				</button>

				<h2 className="modal-title">Nueva Subtarea</h2>

				<form onSubmit={handleSubmit} className="subtask-form">
					<div className="modern-input-group">
						<label htmlFor="name">¿Qué debes hacer? (Nombre)</label>
						<input
							id="name"
							type="text"
							className={`modern-input ${errors.name ? "input-error" : ""}`}
							placeholder="Ej: Leer capítulo 3"
							value={formData.name}
							onChange={(e) => setFormData({ ...formData, name: e.target.value })}
							disabled={isLoading}
						/>
						{errors.name && <span className="error-message">{errors.name}</span>}
					</div>

					<div className="form-row">
						<div className="modern-input-group">
							<label htmlFor="estimated_hours">¿Cuánto tiempo tomará? (Horas)</label>
							<input
								id="estimated_hours"
								type="number"
								step="0.5"
								className={`modern-input ${errors.estimated_hours ? "input-error" : ""}`}
								placeholder="Ej: 2.5"
								value={formData.estimated_hours || ""}
								onChange={(e) =>
									setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) })
								}
								disabled={isLoading}
							/>
							{errors.estimated_hours && (
								<span className="error-message">{errors.estimated_hours}</span>
							)}
						</div>

						<div className="modern-input-group">
							<label htmlFor="target_date">Fecha objetivo</label>
							<input
								id="target_date"
								type="date"
								className={`modern-input ${errors.target_date ? "input-error" : ""}`}
								value={formData.target_date}
								onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
								disabled={isLoading}
							/>
							{errors.target_date && <span className="error-message">{errors.target_date}</span>}
						</div>
					</div>

					<div className="modal-actions">
						<button type="button" onClick={onClose} className="btn-secondary" disabled={isLoading}>
							Cancelar
						</button>
						<button type="submit" className="btn-primary" disabled={isLoading}>
							{isLoading ? <Loader2 className="spinner" size={18} /> : "Crear Subtarea"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
