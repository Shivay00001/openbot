package com.openbot.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * OpenBot Persistent Foreground Agent Service
 * 
 * Guarantees 24/7 background liveness on Android:
 * - Runs the embedded LocalPhoneServer (port 8765)
 * - Holds partial WakeLock during autonomous execution workflows
 * - Displays active agent telemetry notification
 */
class OpenBotAgentService : Service() {

    private var localServer: LocalPhoneServer? = null
    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val CHANNEL_ID = "openbot_agent_channel"
        const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildForegroundNotification("OpenBot Agent Active — Ready for autonomous tasks"))

        // Acquire WakeLock to prevent OS sleep during active tasks
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "OpenBot::AgentWakeLock")
        wakeLock?.acquire(60 * 60 * 1000L) // 1 hour max safety timeout

        // Start embedded phone server
        localServer = LocalPhoneServer(8765)
        localServer?.start()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        localServer?.stop()
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "OpenBot Autonomous Background Agent",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps OpenBot on-device phone automation ready"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(contentText: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("OpenBot Universal Phone Controller")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
