"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {
  const [dialogues, setDialogues] = useState<
    Array<Schema["Dialogue"]["type"]>
  >([]);

  useEffect(() => {
    const sub = client.models.Dialogue.observeQuery().subscribe({
      next: (data) => setDialogues([...data.items]),
    });
    return () => sub.unsubscribe();
  }, []);

  return (
    <main>
      <h1>Practice dialogues</h1>
      <p>Sign in to load dialogues from the API.</p>
      <ul>
        {dialogues.map((d) => (
          <li key={d.id}>{d.title}</li>
        ))}
      </ul>
      <div>
        🥳 App successfully hosted. Dialogues are managed in the admin console.
        <br />
        <a href="https://docs.amplify.aws/nextjs/start/quickstart/nextjs-app-router-client-components/">
          Review next steps of this tutorial.
        </a>
      </div>
    </main>
  );
}
