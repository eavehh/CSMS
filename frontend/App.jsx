import React, { useState } from 'react';
import { spawnChargePointClient } from '../utils/spawnClient';  // Твой путь
import { ChildProcess } from 'child_process';  // Импорт типа (npm i @types/node)

function App() {
    const [clients, setClients] = useState < { id: string, process: ChildProcess } > ([]);  // Без пробелов в < >, [] в конце

    const addClient = () => {
        const id = `CP_${(clients.length + 1).toString().padStart(3, '0')}`;
        const process = spawnChargePointClient(id);
        setClients([...clients, { id, process }]);
    };

    const stopClient = (id) => {
        const client = clients.find(c => c.id === id);
        if (client) {
            client.process.kill();
            setClients(clients.filter(c => c.id !== id));
        }
    };

    return (
        <div>
            <h1>CSMS Client Manager</h1>
            <button onClick={addClient}>Add Charge Point</button>
            <table>
                <thead>
                    <tr><th>ID</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {clients.map(c => (
                        <tr key={c.id}>
                            <td>{c.id}</td>
                            <td>Connected (logs in console)</td>
                            <td><button onClick={() => stopClient(c.id)}>Stop</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default App;