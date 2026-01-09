import Lottie
import SwiftUI

struct WelcomeLottieView: View {
    let size: CGFloat

    init(size: CGFloat = 280) {
        self.size = size
    }

    var body: some View {
        LottieView(animation: .named("welcome-animation"))
            .playing(loopMode: .loop)
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

#Preview {
    WelcomeLottieView()
}
