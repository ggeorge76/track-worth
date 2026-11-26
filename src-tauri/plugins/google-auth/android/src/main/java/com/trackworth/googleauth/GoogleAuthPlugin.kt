package com.trackworth.googleauth

import android.app.Activity
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Scope
import java.util.UUID

@InvokeArg
class AuthorizeArgs {
    var interactive: Boolean = false
    var scopes: Array<String> = emptyArray()
}

@InvokeArg
class TokenArgs {
    var token: String = ""
}

/**
 * Google sign-in for TrackWorth on Android (ADR-0019). Google Play services keeps the user's
 * grant, so a fresh access token can be requested silently at any time; nothing secret is stored
 * by the app. Only the app's Rust code calls these commands.
 */
@TauriPlugin
class GoogleAuthPlugin(private val activity: Activity) : Plugin(activity) {
    private val client get() = Identity.getAuthorizationClient(activity)

    @Command
    fun authorize(invoke: Invoke) {
        val args = invoke.parseArgs(AuthorizeArgs::class.java)
        val request = AuthorizationRequest.builder()
            .setRequestedScopes(args.scopes.map { Scope(it) })
            .build()
        client.authorize(request)
            .addOnSuccessListener { result ->
                val pending = result.pendingIntent
                when {
                    !result.hasResolution() -> resolveToken(invoke, result)
                    !args.interactive -> invoke.reject("Sign-in needed", "needs-consent")
                    pending == null -> invoke.reject("Sign-in couldn't start", "failed")
                    else -> askUser(invoke, pending.intentSender)
                }
            }
            .addOnFailureListener { e -> invoke.reject(e.message ?: "Sign-in failed", "failed") }
    }

    /** Shows Google's account picker and consent screen, then returns the token. */
    private fun askUser(invoke: Invoke, sender: android.content.IntentSender) {
        val owner = activity as? ComponentActivity
            ?: return invoke.reject("Sign-in couldn't start", "failed")
        // Registered on demand (not tied to the lifecycle), and removed after one use.
        var launcher: ActivityResultLauncher<IntentSenderRequest>? = null
        launcher = owner.activityResultRegistry.register(
            "google-auth-${UUID.randomUUID()}",
            ActivityResultContracts.StartIntentSenderForResult(),
        ) { outcome ->
            launcher?.unregister()
            if (outcome.resultCode != Activity.RESULT_OK) {
                rejectUnsuccessful(invoke, outcome.data)
                return@register
            }
            try {
                resolveToken(invoke, client.getAuthorizationResultFromIntent(outcome.data))
            } catch (e: Exception) {
                invoke.reject(e.message ?: "Sign-in failed", "failed")
            }
        }
        launcher.launch(IntentSenderRequest.Builder(sender).build())
    }

    /**
     * Google's screen also closes without success when Google itself refuses, e.g. when no OAuth
     * client matches this app's signing key (UNREGISTERED_ON_API_CONSOLE). Its status rides in the
     * result, so tell that apart from the user backing out and don't call a refusal "cancelled".
     */
    private fun rejectUnsuccessful(invoke: Invoke, data: android.content.Intent?) {
        val status = try {
            data?.let { client.getAuthorizationResultFromIntent(it) }
            null
        } catch (e: ApiException) {
            e.statusCode
        } catch (e: Exception) {
            null
        }
        when (status) {
            null, CommonStatusCodes.CANCELED ->
                invoke.reject("Sign-in was cancelled", "cancelled")
            CommonStatusCodes.NETWORK_ERROR ->
                invoke.reject("Couldn't reach Google. Check your internet connection.", "failed")
            else -> invoke.reject(
                "Google didn't allow sign-in for this copy of TrackWorth. " +
                    "Please try again later, or reinstall the app from Google Play. (code $status)",
                "failed",
            )
        }
    }

    private fun resolveToken(invoke: Invoke, result: AuthorizationResult) {
        val token = result.accessToken ?: return invoke.reject("No access token", "failed")
        invoke.resolve(JSObject().put("accessToken", token))
    }

    @Command
    fun clearToken(invoke: Invoke) {
        val args = invoke.parseArgs(TokenArgs::class.java)
        client.clearToken(ClearTokenRequest.builder().setToken(args.token).build())
            .addOnCompleteListener { invoke.resolve() }
    }
}
