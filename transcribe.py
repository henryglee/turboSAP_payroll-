import assemblyai as aai
import pandas as pd
import time

# Replace with the API key
aai.settings.api_key = "93d84d329d6b4f3d8a1d43b408f0ba3a"

# Define the transcription function using AssemblyAI
def transcribe_with_assemblyai(file_path):
    # URL of the file to transcribe
    FILE_URL = file_path

    # Set additional parameters for the transcription
    config = aai.TranscriptionConfig(
        speech_model=aai.SpeechModel.best,
        speaker_labels=True,
        language_detection=True
    )

    transcriber = aai.Transcriber(config=config)
    transcript = transcriber.transcribe(FILE_URL)

    # Poll for the status of the transcription
    while transcript.status not in [aai.TranscriptStatus.completed, aai.TranscriptStatus.error]:
        print("Transcription in progress... waiting 10 seconds")
        time.sleep(10)
        transcript = transcriber.get_transcript(transcript.id)
    
    if transcript.status == aai.TranscriptStatus.error:
        print(transcript.error)
        return None
    else:
        return transcript

# Process the transcription results and save to CSV
def process_transcription(transcript):
    results = []
    current_speaker = None
    current_segment = {
        "start_time": None,
        "end_time": None,
        "speaker": None,
        "text": ""
    }

    for word in transcript.words:
        speaker = word.speaker
        if speaker != current_speaker:
            if current_speaker is not None:
                results.append(current_segment)
            current_segment = {
                "start_time": word.start / 1000.0,  # Convert ms to seconds
                "end_time": word.end / 1000.0,      # Convert ms to seconds
                "speaker": speaker,
                "text": word.text
            }
            current_speaker = speaker
        else:
            current_segment["end_time"] = word.end / 1000.0
            current_segment["text"] += f" {word.text}"

    # Add the last segment
    if current_speaker is not None:
        results.append(current_segment)
    
    return results

def save_to_csv(results, file_name="transcription_with_speaker_segments.csv"):
    df = pd.DataFrame(results)

    # Convert speaker labels to "Speaker 1", "Speaker 2", etc.
    speaker_mapping = {}
    speaker_counter = 1

    def map_speaker(speaker_label):
        nonlocal speaker_counter
        if speaker_label not in speaker_mapping:
            speaker_mapping[speaker_label] = f"Speaker {speaker_counter}"
            speaker_counter += 1
        return speaker_mapping[speaker_label]

    df["speaker"] = df["speaker"].apply(map_speaker)
    df.to_csv(file_name, index=False)

    print(f"Results have been saved to {file_name}")
    return df

# Transcribe and process the entire audio file
# Path to the uploaded audio file
audio_file_path = "/Users/mengkehan/Desktop/Cockpit_during_flight.m4a"

# Transcribe using AssemblyAI
transcript = transcribe_with_assemblyai(audio_file_path)

if transcript:
    # Process and save the results to CSV
    results = process_transcription(transcript)
    save_to_csv(results)

    # Print the results
    print("Speaker Segments:")
    for result in results:
        start_time = result['start_time']
        end_time = result['end_time']
        speaker = result['speaker']
        text = result['text']
        print(f"{start_time:.2f}-{end_time:.2f} {speaker}: {text}")
else:
    print("Transcription failed.")
