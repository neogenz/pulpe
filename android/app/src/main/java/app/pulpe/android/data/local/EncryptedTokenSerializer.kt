package app.pulpe.android.data.local

import androidx.datastore.core.Serializer
import com.google.crypto.tink.Aead
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.InputStream
import java.io.OutputStream

@Serializable
data class TokenData(
    val accessToken: String? = null,
    val refreshToken: String? = null
)

class EncryptedTokenSerializer(
    private val aead: Aead
) : Serializer<TokenData> {

    override val defaultValue: TokenData = TokenData()

    override suspend fun readFrom(input: InputStream): TokenData {
        return withContext(Dispatchers.IO) {
            try {
                val encryptedBytes = input.readBytes()
                if (encryptedBytes.isEmpty()) {
                    return@withContext defaultValue
                }
                val decryptedBytes = aead.decrypt(encryptedBytes, null)
                Json.decodeFromString(TokenData.serializer(), String(decryptedBytes))
            } catch (e: Exception) {
                defaultValue
            }
        }
    }

    override suspend fun writeTo(t: TokenData, output: OutputStream) {
        withContext(Dispatchers.IO) {
            val jsonString = Json.encodeToString(TokenData.serializer(), t)
            val encryptedBytes = aead.encrypt(jsonString.toByteArray(), null)
            output.write(encryptedBytes)
        }
    }
}
