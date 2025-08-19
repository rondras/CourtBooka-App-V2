#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>

@interface AudioSessionManager : NSObject <RCTBridgeModule>
@end

@implementation AudioSessionManager

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(setAudioSession) {
  AVAudioSession *session = [AVAudioSession sharedInstance];
  NSError *error = nil;
  [session setCategory:AVAudioSessionCategoryPlayAndRecord
                  mode:AVAudioSessionModeVoiceChat
               options:AVAudioSessionCategoryOptionAllowBluetooth | AVAudioSessionCategoryOptionDefaultToSpeaker
                 error:&error];
  if (error) {
    NSLog(@"Audio session error: %@", error);
  }
  [session setActive:YES error:&error];
  if (error) {
    NSLog(@"Audio session activation error: %@", error);
  }
}

@end