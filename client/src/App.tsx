import { useState } from "react";
import client from "./api/client";
import "./App.css";

function App() {
	const [data, setData] = useState<string | null>(null);

	const handleConnect = async () => {
		try {
			const response = await client.get("/health/");
			setData(JSON.stringify(response.data, null, 2));
		} catch (error) {
			console.error(error);
			setData("Error al conectar con el servidor");
		}
	};

	return (
		<>
			<div style={{ padding: "20px" }}>
				<h1>Llamado a la API</h1>
				<button onClick={handleConnect}>Probar conexión /health</button>
				{data && (
					<div
						style={{
							marginTop: "20px",
							padding: "20px",
							background: "#1a1a1a",
							color: "#ffffff",
							borderRadius: "8px",
							border: "1px solid #333",
							textAlign: "left",
						}}
					>
						<h3 style={{ margin: "0 0 10px 0" }}>Respuesta del Servidor:</h3>
						<pre style={{ margin: 0, overflow: "auto" }}>{data}</pre>
					</div>
				)}
			</div>
		</>
	);
}

export default App;
