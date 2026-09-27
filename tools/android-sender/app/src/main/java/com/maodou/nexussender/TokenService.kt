package com.maodou.nexussender

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.ServerSocket
import kotlin.concurrent.thread

/**
 * 前台服务：在 8123 端口起一个极小 HTTP 服务，把当前 Token 以 JSON 形式发给手表。
 *   GET /token.json  ->  {"token":"eyJ..."}
 * 手表端只需访问 http://<手机IP>:8123/token.json
 */
class TokenService : Service() {

    companion object {
        const val PORT = 8123
        const val CH_ID = "token_share"
        const val CH_NAME = "Token 共享服务"
        @Volatile var running = false
        @Volatile var token: String = ""
        /** 最近一次的手表访问记录（给界面显示，确认手表取到过）*/
        @Volatile var lastHit: String = ""
    }

    private var server: ServerSocket? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundCompat()
        startServer()
        return START_STICKY
    }

    private fun startForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CH_ID) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(CH_ID, CH_NAME, NotificationManager.IMPORTANCE_LOW)
                )
            }
        }
        val notif = NotificationCompat.Builder(this, CH_ID)
            .setContentTitle("Token 共享中")
            .setContentText("端口 $PORT · 手表可直接取 Token")
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .build()
        startForeground(1001, notif)
    }

    private fun startServer() {
        if (running) return
        running = true
        thread(name = "token-server") {
            try {
                server = ServerSocket(PORT)
                while (running) {
                    val c = try { server?.accept() } catch (e: Exception) { null } ?: continue
                    try {
                        val reader = BufferedReader(InputStreamReader(c.getInputStream()))
                        val reqLine = reader.readLine() ?: ""
                        // 读掉剩余头部
                        while (true) {
                            val l = reader.readLine() ?: break
                            if (l.isEmpty()) break
                        }
                        val body = "{\"token\":\"$token\"}"
                        val bytes = body.toByteArray(Charsets.UTF_8)
                        val head = "HTTP/1.1 200 OK\r\n" +
                                "Content-Type: application/json; charset=utf-8\r\n" +
                                "Content-Length: ${bytes.size}\r\n" +
                                "Connection: close\r\n\r\n"
                        c.getOutputStream().write(head.toByteArray(Charsets.UTF_8))
                        c.getOutputStream().write(bytes)
                        c.getOutputStream().flush()
                        lastHit = reqLine
                    } catch (e: Exception) {
                        // 忽略单次请求异常
                    } finally {
                        try { c.close() } catch (e: Exception) {}
                    }
                }
            } catch (e: Exception) {
                running = false
            }
        }
    }

    override fun onDestroy() {
        running = false
        try { server?.close() } catch (e: Exception) {}
        server = null
        super.onDestroy()
    }
}

/** 取本机局域网 IPv4（热点时通常是 192.168.43.1 之类）*/
fun localIpv4(): String {
    try {
        for (nif in NetworkInterface.getNetworkInterfaces()) {
            if (!nif.isUp || nif.isLoopback) continue
            for (addr in nif.inetAddresses) {
                if (addr is Inet4Address && !addr.isLoopbackAddress) {
                    val ip = addr.hostAddress ?: continue
                    if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
                        return ip
                    }
                }
            }
        }
        // 没找到私有网段就退而求其次
        for (nif in NetworkInterface.getNetworkInterfaces()) {
            if (!nif.isUp || nif.isLoopback) continue
            for (addr in nif.inetAddresses) {
                if (addr is Inet4Address && !addr.isLoopbackAddress) return addr.hostAddress ?: ""
            }
        }
    } catch (e: Exception) {
    }
    return ""
}
