const { 
  MediaConvertClient, 
  CreateJobCommand,
  GetJobCommand
} = require('@aws-sdk/client-mediaconvert');

class MediaConvertService {
  constructor() {
    // Make endpoint optional for testing
    this.isConfigured = false;
    if (process.env.AWS_MEDIACONVERT_ENDPOINT) {
      this.configure();
    }
  }

  configure() {
    if (!process.env.AWS_MEDIACONVERT_ENDPOINT) {
      throw new Error('AWS_MEDIACONVERT_ENDPOINT is required');
    }
    if (!process.env.AWS_MEDIACONVERT_ROLE) {
      throw new Error('AWS_MEDIACONVERT_ROLE is required');
    }
    if (!process.env.AWS_MEDIACONVERT_QUEUE) {
      throw new Error('AWS_MEDIACONVERT_QUEUE is required');
    }

    this.endpoint = process.env.AWS_MEDIACONVERT_ENDPOINT;
    this.role = process.env.AWS_MEDIACONVERT_ROLE;
    this.queue = process.env.AWS_MEDIACONVERT_QUEUE;

    this.client = new MediaConvertClient({
      endpoint: this.endpoint,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.isConfigured = true;
  }

  checkConfiguration() {
    if (!this.isConfigured) {
      console.log('⚠️ MediaConvert not configured. Skipping MediaConvert operations.');
      return false;
    }
    return true;
  }

  calculateJobSettings(segments, outputKey) {
    // Create audio selectors for each segment
    const audioSelectors = {};
    segments.forEach((segment, index) => {
      audioSelectors[`Audio${index + 1}`] = {
        ExternalAudioFileInput: segment.url,
        ProgramSelection: 1,
        Offset: Math.round(segment.startTime * 1000) // Convert to milliseconds
      };
    });

    return {
      Settings: {
        TimecodeConfig: {
          Source: 'ZEROBASED'
        },
        Inputs: [{
          AudioSelectors: audioSelectors,
          AudioSelectorGroups: {
            'Audio Selector Group 1': {
              AudioSelectorNames: Object.keys(audioSelectors)
            }
          }
        }],
        OutputGroups: [{
          Name: 'Audio Group',
          OutputGroupSettings: {
            Type: 'FILE_GROUP_SETTINGS',
            FileGroupSettings: {
              Destination: `s3://${outputKey}`
            }
          },
          Outputs: [{
            AudioDescriptions: [{
              AudioSourceName: 'Audio Selector Group 1',
              AudioType: 0,
              AudioTypeControl: 'FOLLOW_INPUT',
              CodecSettings: {
                Codec: 'AAC',
                AacSettings: {
                  AudioDescriptionBroadcasterMix: 'NORMAL',
                  Bitrate: 128000,
                  CodecProfile: 'LC',
                  CodingMode: 'CODING_MODE_2_0',
                  RateControlMode: 'CBR',
                  SampleRate: 44100
                }
              },
              LanguageCodeControl: 'FOLLOW_INPUT',
              RemixSettings: {
                ChannelMapping: {
                  OutputChannels: [
                    {
                      InputChannels: [0, 1]
                    }
                  ]
                },
                ChannelsIn: 2,
                ChannelsOut: 2
              }
            }],
            ContainerSettings: {
              Container: 'MP4',
              Mp4Settings: {
                CslgAtom: 'INCLUDE',
                FreeSpaceBox: 'EXCLUDE',
                MoovPlacement: 'PROGRESSIVE_DOWNLOAD'
              }
            },
            Extension: 'mp4',
            NameModifier: '_combined'
          }]
        }]
      }
    };
  }

  async createPodcastJob({ segments, outputBucket, outputKey, subtitlesUrl }) {
    if (!this.checkConfiguration()) {
      console.log('Simulating podcast assembly...');
      return 'test-job-id';
    }

    const jobSettings = this.calculateJobSettings(segments, `${outputBucket}/${outputKey}`);

    if (subtitlesUrl) {
      const output = jobSettings.Settings.OutputGroups[0].Outputs[0];
      output.CaptionDescriptions = [{
        CaptionSelectorName: 'Captions',
        DestinationSettings: {
          DestinationType: 'SRT_FILE'
        }
      }];
      
      jobSettings.Settings.Inputs[0].CaptionSelectors = {
        Captions: {
          SourceSettings: {
            SourceType: 'SRT',
            FileSourceSettings: {
              SourceFile: subtitlesUrl
            }
          }
        }
      };
    }

    const command = new CreateJobCommand({
      Role: this.role,
      Settings: jobSettings.Settings,
      Queue: this.queue,
      UserMetadata: {
        ConversationId: outputKey.split('/').pop() || 'unknown'
      }
    });

    try {
      console.log('Creating MediaConvert job with settings:', JSON.stringify(jobSettings, null, 2));
      const response = await this.client.send(command);
      return response.Job?.Id || '';
    } catch (error) {
      console.error('Error creating MediaConvert job:', error);
      throw new Error('Failed to create podcast assembly job');
    }
  }

  async getJobStatus(jobId) {
    if (!this.checkConfiguration()) {
      return 'COMPLETE';
    }

    const command = new GetJobCommand({ Id: jobId });
    
    try {
      const response = await this.client.send(command);
      return response.Job?.Status || 'UNKNOWN';
    } catch (error) {
      console.error('Error getting job status:', error);
      throw new Error('Failed to get job status');
    }
  }

  async waitForJobCompletion(jobId, pollInterval = 5000) {
    if (!this.checkConfiguration()) {
      return;
    }

    while (true) {
      const status = await this.getJobStatus(jobId);
      
      if (status === 'COMPLETE') {
        return;
      }
      
      if (status === 'ERROR') {
        throw new Error('MediaConvert job failed');
      }
      
      if (status === 'CANCELED') {
        throw new Error('MediaConvert job was canceled');
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
}

module.exports = {
  MediaConvertService,
  mediaConvert: new MediaConvertService()
};
