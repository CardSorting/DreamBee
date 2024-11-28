import { 
  MediaConvertClient, 
  CreateJobCommand,
  GetJobCommand,
  Input,
  AudioSelector,
  OutputGroup,
  Output
} from '@aws-sdk/client-mediaconvert';

interface AudioSegment {
  url: string;
  startTime: number;
  endTime: number;
  speaker: string;
}

interface PodcastJob {
  segments: AudioSegment[];
  outputBucket: string;
  outputKey: string;
  subtitlesUrl?: string;
}

export class MediaConvertService {
  private client: MediaConvertClient;
  private endpoint: string;
  private queue: string;
  private role: string;

  constructor() {
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
  }

  private createAudioSelectors(segments: AudioSegment[]): { [key: string]: AudioSelector } {
    const selectors: { [key: string]: AudioSelector } = {};
    
    segments.forEach((segment, index) => {
      selectors[`Audio${index + 1}`] = {
        ExternalAudioFileInput: segment.url,
        ProgramSelection: 1,
        Offset: segment.startTime * 1000, // Convert to milliseconds
      };
    });

    return selectors;
  }

  private calculateJobSettings(segments: AudioSegment[], outputKey: string): any {
    const totalDuration = Math.max(...segments.map(s => s.endTime));
    
    return {
      TimecodeConfig: {
        Source: 'ZEROBASED'
      },
      Inputs: segments.map((segment, index) => ({
        AudioSelectors: {
          [`Audio${index + 1}`]: {
            DefaultSelection: 'DEFAULT',
            ExternalAudioFileInput: segment.url,
            ProgramSelection: 1,
            TimecodeSoure: 'ZEROBASED',
            Offset: segment.startTime * 1000 // Convert to milliseconds
          }
        },
        TimecodeSource: 'ZEROBASED'
      })),
      OutputGroups: [
        {
          Name: 'MP3',
          OutputGroupSettings: {
            Type: 'FILE_GROUP_SETTINGS',
            FileGroupSettings: {
              Destination: `s3://${outputKey}`
            }
          },
          Outputs: [
            {
              AudioDescriptions: [
                {
                  AudioSourceName: 'Audio1',
                  CodecSettings: {
                    Codec: 'MP3',
                    Mp3Settings: {
                      Bitrate: 128000,
                      Channels: 2,
                      RateControlMode: 'CBR',
                      SampleRate: 44100
                    }
                  }
                }
              ],
              ContainerSettings: {
                Container: 'RAW'
              },
              Extension: 'mp3',
              NameModifier: '_combined'
            }
          ]
        }
      ]
    };
  }

  async createPodcastJob(job: PodcastJob): Promise<string> {
    const jobSettings = this.calculateJobSettings(job.segments, `${job.outputBucket}/${job.outputKey}`);

    if (job.subtitlesUrl) {
      // Add subtitle configuration if provided
      jobSettings.OutputGroups[0].Outputs[0].CaptionDescriptions = [{
        CaptionSelectorName: 'Captions',
        DestinationSettings: {
          DestinationType: 'SRT_FILE'
        }
      }];
      
      jobSettings.Inputs[0].CaptionSelectors = {
        Captions: {
          SourceSettings: {
            SourceType: 'SRT',
            FileSourceSettings: {
              SourceFile: job.subtitlesUrl
            }
          }
        }
      };
    }

    const command = new CreateJobCommand({
      Role: this.role,
      Settings: jobSettings,
      Queue: this.queue,
      UserMetadata: {
        ConversationId: job.outputKey.split('/').pop() || 'unknown'
      }
    });

    try {
      const response = await this.client.send(command);
      return response.Job?.Id || '';
    } catch (error) {
      console.error('Error creating MediaConvert job:', error);
      throw new Error('Failed to create podcast assembly job');
    }
  }

  async getJobStatus(jobId: string): Promise<string> {
    const command = new GetJobCommand({ Id: jobId });
    
    try {
      const response = await this.client.send(command);
      return response.Job?.Status || 'UNKNOWN';
    } catch (error) {
      console.error('Error getting job status:', error);
      throw new Error('Failed to get job status');
    }
  }

  async waitForJobCompletion(jobId: string, pollInterval = 5000): Promise<void> {
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

export const mediaConvert = new MediaConvertService();
