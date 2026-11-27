plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.enskygr.kodeditor"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.enskygr.kodeditor"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    // Sabit anahtar: her derleme aynı imzayla çıkar, yeni sürüm eskisinin üstüne kurulur.
    signingConfigs {
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        getByName("release") { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    androidResources { noCompress += listOf("js", "css", "ttf") }
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
