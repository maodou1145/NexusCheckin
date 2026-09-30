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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

/**
 * 前台服务：在 8123 端口起一个极小 HTTP 服务，把当前 Token 以 JSON 形式发给手表。
 *   GET /token.json  ->  {"token":"eyJ..."}
 *
 * 手表端可访问的地址（注意：**手表上的 127.0.0.1 指手表自己**，只在做了端口转发时才通）：
 *   · http://<手机局域网IP>:8123/token.json   ← 正常情况下填这个
 *   · http://127.0.0.1:8123/token.json       ← 端口转发 / 本机代理场景
 *
 * 服务还用 [log] 记一份内存日志（界面可看），排查「手表连不上」「取到空 Token」很方便。
 */
class TokenService : Service() {

    companion object {
        const val PORT = 8123
        const val CH_ID = "token_share"
        const val CH_NAME = "Token 共享服务"
        const val LOG_TAG = "NexusSender"
        private const val LOG_MAX = 300            // 内存里最多留这么多条
        private val logBuf = ArrayDeque<String>()
        private val tsFmt = SimpleDateFormat("HH:mm:ss", Locale.US)

        @Volatile var running = false
        @Volatile var token: String = ""

        /** 最近一次的手表访问记录（给界面显示，确认手表取到过）*/
        @Volatile var lastHit: String = ""

        /** 记一条日志（带时间戳，只留最近 LOG_MAX 条）*/
        fun log(msg: String) {
            val line = "[${tsFmt.format(Date())}] $msg"
            synchronized(logBuf) {
                logBuf.addLast(line)
                while (logBuf.size > LOG_MAX) logBuf.removeFirst()
            }
            android.util.Log.i(LOG_TAG, msg)
        }

        /** 取最近 n 条（界面显示用）*/
        fun recentLogs(n: Int): List<String> = synchronized(logBuf) { logBuf.toList().takeLast(n) }

        fun clearLogs() { synchronized(logBuf) { logBuf.clear() } }

        /** 本机可被访问的地址列表：局域网 IP（正常用这个）+ 127.0.0.1（端口转发场景）*/
        fun listenAddrs(): List<String> {
            val list = ArrayList<String>()
            val ip = localIpv4()
            if (ip.isNotEmpty()) list.add(ip)
            list.add("127.0.0.1")
            return list
        }
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
        log("服务启动，监听 0.0.0.0:$PORT（局域网与本机都能连）")
        log("可用地址：" + listenAddrs().joinToString(" / "))
        log("Token 状态：" + if (token.isEmpty()) "未抓取（先在界面点「抓取 Token」）" else "${token.length} 字符 ✓")

        thread(name = "token-server") {
            try {
                server = ServerSocket(PORT)
                while (running) {
                    val c = try { server?.accept() } catch (e: Exception) { null } ?: continue
                    try {
                        val from = try { c.inetAddress?.hostAddress ?: "?" } catch (e: Exception) { "?" }
                        val reader = BufferedReader(InputStreamReader(c.getInputStream()))
                        val reqLine = reader.readLine() ?: ""
                        // 读掉剩余头部
                        while (true) {
                            val l = reader.readLine() ?: break
                            if (l.isEmpty()) break
                        }
                        log("收到请求：$from → $reqLine")

                        val hasToken = token.isNotEmpty()
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
                        if (hasToken) {
                            log("已返回 Token（${token.length} 字符）✓ 手表那边应该提示取件成功了")
                        } else {
                            log("⚠️ 返回的是空 Token —— 先在界面点「抓取 Token」再让手表取")
                        }
                    } catch (e: Exception) {
                        log("处理请求出错：${e.javaClass.simpleName} ${e.message ?: ""}")
                    } finally {
                        try { c.close() } catch (e: Exception) {}
                    }
                }
                log("服务已停止（监听结束）")
            } catch (e: Exception) {
                log("❌ 启动失败：${e.javaClass.simpleName} ${e.message ?: ""}")
                if (e is java.net.BindException) {
                    log("端口 $PORT 被占用？先停掉上一次的共享再试")
                }
                running = false
            }
        }
    }

    override fun onDestroy() {
        log("收到停止指令，关闭服务")
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
