"use client";

import { useState } from "react";
import type { Notification } from "@/lib/db";

interface Props {
  initialNotifications: Notification[];
}

export default function NotificationBox({ initialNotifications }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>(
    initialNotifications.filter((n) => !n.read)
  );

  if (notifications.length === 0) return null;

  async function handleMarkAsRead(id: number) {
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      // Silently fail — the optimistic update already removed it from view
    }
  }

  async function handleDismiss(id: number) {
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    } catch {
      // Silently fail — the optimistic update already removed it from view
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr.replace(" ", "T") + "Z");
    return date.toLocaleString("nl-NL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="notif-box">
      <div className="notif-header">
        <span className="notif-title">
          <span className="notif-dot" />
          {notifications.length === 1
            ? "1 nieuwe melding"
            : `${notifications.length} nieuwe meldingen`}
        </span>
      </div>
      <ul className="notif-list">
        {notifications.map((n) => (
          <li key={n.id} className="notif-item">
            <div className="notif-content">
              <span className="notif-icon">🎉</span>
              <div className="notif-body">
                <p className="notif-message">{n.message}</p>
                <p className="notif-time">{formatDate(n.created_at)}</p>
              </div>
            </div>
            <div className="notif-actions">
              <button
                className="btn ghost sm"
                onClick={() => handleMarkAsRead(n.id)}
              >
                Gelezen
              </button>
              <button
                className="btn danger sm"
                onClick={() => handleDismiss(n.id)}
              >
                Verwijder
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
